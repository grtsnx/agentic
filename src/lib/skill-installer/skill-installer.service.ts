import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm,
  lstat,
} from 'node:fs/promises';
import { resolve, join, dirname, posix } from 'node:path';

// Leaf imports keep capability registration independent of the config/lib barrels.
import {
  githubCommitSchema,
  githubTreeSchema,
  skillInstallActionSchema,
} from '../../config/schema/extensions/skill-install.schema.js';
import { parseSkillMetadata } from '../../config/agent/skills/skills.service.js';
import type { SkillInstallAction } from '@/config';

@Injectable()
export class SkillInstallerService {
  private readonly root: string;
  constructor(@Optional() @Inject('SKILL_INSTALL_ROOT') root?: string) {
    this.root = resolve(root ?? 'skills/installed');
  }
  private source(input: string, selected: string | null) {
    if (input.length > 1000 || /[%\\]|(?:^|\/)\.\.(?:\/|$)/.test(input))
      throw new Error('INVALID_SKILL_SOURCE');
    const url = new URL(input);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      throw new Error('INVALID_SKILL_SOURCE');
    const parts = url.pathname.replace(/\/$/, '').slice(1).split('/');
    if (parts.some((part) => !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part)))
      throw new Error('INVALID_SKILL_SOURCE');
    const [owner, repo] = parts;
    if (!owner || !repo) throw new Error('INVALID_SKILL_SOURCE');
    let ref = 'HEAD',
      directory: string | undefined,
      name = selected ?? undefined;
    if (['skills.sh', 'www.skills.sh'].includes(url.hostname)) {
      if (parts.length !== 3) throw new Error('USE_A_SPECIFIC_SKILL_LINK');
      name = parts[2];
    } else if (url.hostname === 'github.com') {
      if (parts.length > 2) {
        if (!['tree', 'blob'].includes(parts[2]!) || parts.length < 5)
          throw new Error('INVALID_SKILL_SOURCE');
        ref = parts[3]!;
        directory = parts
          .slice(4)
          .join('/')
          .replace(/(?:^|\/)SKILL\.md$/, '');
      }
    } else throw new Error('INVALID_SKILL_SOURCE');
    return {
      repository: `${owner}/${repo.replace(/\.git$/, '')}`,
      ref,
      directory,
      name,
    };
  }
  private async fetchText(url: string, signal: AbortSignal, limit: number) {
    signal.throwIfAborted();
    const response = await fetch(url, {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Agentic-skills',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('SKILL_SOURCE_UNAVAILABLE');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('EMPTY_SKILL_SOURCE');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new Error('SKILL_SOURCE_TOO_LARGE');
        chunks.push(value);
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(
        Buffer.concat(chunks),
      );
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
  private raw(repository: string, commit: string, path: string) {
    return `https://raw.githubusercontent.com/${repository}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  private hash(text: string) {
    return createHash('sha256').update(text).digest('hex');
  }
  async prepare(
    source: string,
    selected: string | null,
    external: AbortSignal,
  ): Promise<SkillInstallAction> {
    const signal = AbortSignal.any([external, AbortSignal.timeout(30000)]);
    const { repository, ref, directory, name } = this.source(source, selected);
    const { sha: commit } = githubCommitSchema.parse(
      JSON.parse(
        await this.fetchText(
          `https://api.github.com/repos/${repository}/commits/${ref}`,
          signal,
          128000,
        ),
      ),
    );
    const { tree } = githubTreeSchema.parse(
      JSON.parse(
        await this.fetchText(
          `https://api.github.com/repos/${repository}/git/trees/${commit}?recursive=1`,
          signal,
          1000000,
        ),
      ),
    );
    const candidates = tree.filter(
      (item) => item.path === 'SKILL.md' || item.path.endsWith('/SKILL.md'),
    );
    let matches = candidates.filter((item) =>
      directory !== undefined
        ? posix.dirname(item.path).replace(/^\.$/, '') === directory
        : !name || posix.basename(posix.dirname(item.path)) === name,
    );
    // Directory names may differ from the skill name used by skills.sh.
    const fetched = new Map<string, string>();
    if (matches.length === 0 && name && candidates.length <= 32) {
      matches = [];
      for (const candidate of candidates) {
        if (
          candidate.type !== 'blob' ||
          !['100644', '100755'].includes(candidate.mode) ||
          (candidate.size ?? 64001) > 64000
        )
          continue;
        const content = await this.fetchText(
          this.raw(repository, commit, candidate.path),
          signal,
          64000,
        );
        fetched.set(candidate.path, content);
        try {
          if (parseSkillMetadata(content).name === name)
            matches.push(candidate);
        } catch {
          /* An unrelated malformed skill is not a match. */
        }
      }
    }
    if (matches.length !== 1) throw new Error('SELECT_ONE_SKILL_DIRECTORY');
    const root = posix.dirname(matches[0]!.path).replace(/^\.$/, '');
    const prefix = root ? `${root}/` : '';
    const entries = tree.filter(
      (item) => item.path.startsWith(prefix) && item.type !== 'tree',
    );
    if (
      entries.some(
        (item) =>
          !['100644', '100755'].includes(item.mode) || item.type !== 'blob',
      )
    )
      throw new Error('SKILL_LINKS_NOT_ALLOWED');
    const documents = entries.filter((item) => /\.(md|txt)$/i.test(item.path));
    if (
      documents.length > 32 ||
      documents.some((item) => (item.size ?? 64001) > 64000) ||
      documents.reduce((sum, item) => sum + (item.size ?? 0), 0) > 256000
    )
      throw new Error('SKILL_BUNDLE_TOO_LARGE');
    const files: SkillInstallAction['files'] = [];
    let instructions = '';
    for (const entry of documents) {
      const text =
        fetched.get(entry.path) ??
        (await this.fetchText(
          this.raw(repository, commit, entry.path),
          signal,
          64000,
        ));
      const path = entry.path.slice(prefix.length);
      if (path === 'SKILL.md') instructions = text;
      files.push({
        path,
        bytes: Buffer.byteLength(text),
        sha256: this.hash(text),
      });
    }
    const metadata = parseSkillMetadata(instructions);
    return skillInstallActionSchema.parse({
      tool: 'install_skill',
      repository,
      commit,
      directory: root,
      name: metadata.name,
      description: metadata.description,
      preview: instructions.slice(0, 4000),
      files,
      omittedFiles: entries.length - documents.length,
    });
  }
  async installedPaths() {
    const entries = await readdir(this.root, { withFileTypes: true }).catch(
      (error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      },
    );
    return entries
      .filter(
        (entry) =>
          entry.isDirectory() && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(entry.name),
      )
      .map((entry) => join(this.root, entry.name));
  }
  async install(input: SkillInstallAction, external: AbortSignal) {
    const action = skillInstallActionSchema.parse(input),
      signal = AbortSignal.any([external, AbortSignal.timeout(30000)]);
    signal.throwIfAborted();
    await mkdir(this.root, { recursive: true });
    if ((await realpath(this.root)) !== this.root)
      throw new Error('SKILL_DESTINATION_UNSAFE');
    // A cross-process lock prevents concurrent installs from replacing a skill.
    const lock = await open(
      join(this.root, '.install.lock'),
      'wx',
      0o600,
    ).catch(() => {
      throw new Error('SKILL_INSTALL_BUSY');
    });
    let stage: string | undefined;
    try {
      const destination = join(this.root, action.name);
      if (
        await lstat(destination).then(
          () => true,
          (error) => {
            if (error.code === 'ENOENT') return false;
            throw error;
          },
        )
      )
        throw new Error('SKILL_ALREADY_INSTALLED');
      if ((await this.installedPaths()).length >= 32)
        throw new Error('SKILL_LIMIT_REACHED');
      stage = await mkdtemp(join(this.root, '.pending-'));
      for (const file of action.files) {
        if (!/\.(md|txt)$/i.test(file.path))
          throw new Error('SKILL_FILE_NOT_ALLOWED');
        const text = await this.fetchText(
          this.raw(
            action.repository,
            action.commit,
            [action.directory, file.path].filter(Boolean).join('/'),
          ),
          signal,
          64000,
        );
        if (
          this.hash(text) !== file.sha256 ||
          Buffer.byteLength(text) !== file.bytes
        )
          throw new Error('SKILL_CONTENT_CHANGED');
        const path = join(stage, file.path);
        await mkdir(dirname(path), { recursive: true });
        const handle = await open(path, 'wx', 0o600);
        try {
          await handle.writeFile(text);
          await handle.sync();
        } finally {
          await handle.close();
        }
      }
      const metadata = await open(join(stage, '.source.json'), 'wx', 0o600);
      try {
        await metadata.writeFile(JSON.stringify(action, null, 2));
        await metadata.sync();
      } finally {
        await metadata.close();
      }
      signal.throwIfAborted();
      // Only a complete directory becomes visible to skill discovery. No scripts run.
      await rename(stage, destination);
      stage = undefined;
      return {
        status: 'installed',
        name: action.name,
        source: `https://github.com/${action.repository}/tree/${action.commit}/${action.directory}`,
        destination: `skills/installed/${action.name}`,
        omittedFiles: action.omittedFiles,
      };
    } finally {
      try {
        if (stage) await rm(stage, { recursive: true, force: true });
      } finally {
        await lock.close();
        await rm(join(this.root, '.install.lock'), { force: true });
      }
    }
  }
}

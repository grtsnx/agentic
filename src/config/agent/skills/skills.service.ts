import { Injectable } from '@nestjs/common';
import { open, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { parse } from 'yaml';
import { skillMetadataSchema } from '../../schema/extensions/extensions.schema.js';

// Bound reads before allocation, including manifest and skill reference reads.
export async function readCapabilityFile(path: string, maxBytes = 64000) {
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxBytes)
      throw new Error('CAPABILITY_FILE_INVALID');
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > maxBytes) throw new Error('CAPABILITY_FILE_TOO_LARGE');
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await file.close();
  }
}

@Injectable()
export class SkillsService {
  private async catalog(paths: string[]) {
    const entries = await Promise.all(
      paths.map(async (path) => {
        const root = await realpath(resolve(path));
        const content = await this.readWithin(root, 'SKILL.md');
        const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
        if (!match) throw new Error('SKILL_FRONT_MATTER_REQUIRED');
        const { name, description } = skillMetadataSchema.parse(
          parse(match[1]!, { maxAliasCount: 0 }),
        );
        return { root, name, description };
      }),
    );
    if (new Set(entries.map((entry) => entry.name)).size !== entries.length)
      throw new Error('DUPLICATE_SKILL');
    return entries;
  }
  async list(paths: string[]) {
    return (await this.catalog(paths)).map(({ name, description }) => ({
      name,
      description,
    }));
  }
  async read(paths: string[], name: string, file: string) {
    const skill = (await this.catalog(paths)).find(
      (item) => item.name === name,
    );
    if (!skill) throw new Error('SKILL_NOT_CONFIGURED');
    return this.readWithin(skill.root, file);
  }
  private async readWithin(root: string, file: string) {
    if (
      isAbsolute(file) ||
      file.split(/[\\/]/).some((part) => part.startsWith('.') || !part) ||
      !['.md', '.txt'].includes(extname(file).toLowerCase())
    )
      throw new Error('SKILL_PATH_NOT_ALLOWED');
    const path = await realpath(resolve(root, file));
    const child = relative(root, path);
    if (!child || child.startsWith('..') || isAbsolute(child))
      throw new Error('SKILL_PATH_NOT_ALLOWED');
    return readCapabilityFile(path);
  }
}

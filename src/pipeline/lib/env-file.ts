import * as fs from 'fs';
import * as path from 'path';

/**
 * Inserts or updates `KEY=value` pairs in a `.env` file without disturbing the
 * rest of the file. Existing keys are rewritten in place (preserving any trailing
 * `# comment`); missing keys are appended; the file is created if absent.
 *
 * Returns the keys that were actually changed (empty when everything already matched)
 * plus the resolved file path, so callers can log a precise message.
 */
export function upsertEnvVars(
  vars: Record<string, string>,
  envPath: string = path.resolve(process.cwd(), '.env'),
): { written: string[]; path: string } {
  const existing = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8')
    : '';
  const lines = existing.length ? existing.split(/\r?\n/) : [];
  const written: string[] = [];

  for (const [key, value] of Object.entries(vars)) {
    if (!value) continue;

    const keyMatcher = new RegExp(`^\\s*${key}\\s*=`);
    const idx = lines.findIndex((line) => keyMatcher.test(line));

    if (idx >= 0) {
      const afterKey = lines[idx].replace(keyMatcher, '');
      const commentMatch = afterKey.match(/\s+#.*$/);
      const comment = commentMatch ? commentMatch[0] : '';
      const currentValue = afterKey.replace(/\s+#.*$/, '').trim();
      if (currentValue === value) continue; // already correct — no write
      lines[idx] = `${key}=${value}${comment}`;
      written.push(key);
    } else {
      lines.push(`${key}=${value}`);
      written.push(key);
    }
  }

  if (written.length === 0) return { written, path: envPath };

  let out = lines.join('\n');
  if (!out.endsWith('\n')) out += '\n';
  fs.writeFileSync(envPath, out);
  return { written, path: envPath };
}

/**
 * Blanks the value of each given key in a `.env` file (rewrites `KEY=value` to
 * `KEY=`), preserving the key line and any trailing `# comment` so the next
 * `setup:pipeline` re-provisions and re-fills it. Keys that are absent or already
 * blank are skipped. Returns the keys actually cleared plus the resolved path.
 */
export function clearEnvVars(
  keys: string[],
  envPath: string = path.resolve(process.cwd(), '.env'),
): { cleared: string[]; path: string } {
  if (!fs.existsSync(envPath)) return { cleared: [], path: envPath };

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  const cleared: string[] = [];

  for (const key of keys) {
    const keyMatcher = new RegExp(`^\\s*${key}\\s*=`);
    const idx = lines.findIndex((line) => keyMatcher.test(line));
    if (idx < 0) continue;

    const afterKey = lines[idx].replace(keyMatcher, '');
    const commentMatch = afterKey.match(/\s+#.*$/);
    const comment = commentMatch ? commentMatch[0] : '';
    const currentValue = afterKey.replace(/\s+#.*$/, '').trim();
    if (currentValue === '') continue; // already blank — no write

    lines[idx] = `${key}=${comment}`;
    cleared.push(key);
  }

  if (cleared.length === 0) return { cleared, path: envPath };

  let out = lines.join('\n');
  if (!out.endsWith('\n')) out += '\n';
  fs.writeFileSync(envPath, out);
  return { cleared, path: envPath };
}

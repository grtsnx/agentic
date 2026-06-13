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

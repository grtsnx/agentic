import { readFileSync } from 'node:fs';

const entryUrl = new URL(import.meta.resolve('thinking-orbs/engine'));
const entry = readFileSync(entryUrl, 'utf8');
// The pinned package splits its React-free engine into an entry and one chunk.
// Serve exactly those files, never a user-supplied path into node_modules.
const chunk = /^import .* from "\.\/(index-[\w-]+\.js)";/m.exec(entry)?.[1];
if (!chunk) throw new Error('Unexpected Thinking Orbs engine bundle layout');
const license = readFileSync(new URL('../LICENSE', entryUrl), 'utf8');
const notice = `/* thinking-orbs 0.3.2\n${license} */\n`;

export const ORB_ENGINE_SCRIPT =
  notice + entry.replace(`./${chunk}`, '/playground/orb-core.js');
export const ORB_ENGINE_CORE =
  notice + readFileSync(new URL(chunk, entryUrl), 'utf8');

import type { Readable, Writable } from 'node:stream';

export type CliInput = Readable & { isTTY?: boolean };

export type CliOutput = Writable & { isTTY?: boolean };

import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readHiddenLine } from '../../src/operations/hidden-prompt';

const QUESTION = 'Smoke connection secret: ';
const SECRET = 'zb_conn_typed-by-the-owner';

describe('hidden prompt', () => {
  it('returns the typed line and never echoes it', async () => {
    const terminalInput = new PassThrough();
    const written: string[] = [];
    const answer = readHiddenLine({ question: QUESTION, terminalInput, outputStream: { write: (chunk: string) => written.push(chunk) } });
    terminalInput.write(`${SECRET}\n`);
    expect(await answer).toBe(SECRET);
    expect(written.join('')).toContain(QUESTION);
    expect(written.join('')).not.toContain(SECRET);
  });
});

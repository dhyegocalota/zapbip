import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { readHiddenLine } from '../../src/hidden-prompt';

const PROMPT = 'Connection link: ';
const LINK = 'https://zapbip.example/c/abc123/mcp';
const BACKSPACE = '\u007f';
const INTERRUPT = '\u0003';

function createTerminal(): { stdin: NodeJS.ReadStream; output: PassThrough; setRawMode: ReturnType<typeof vi.fn>; written: () => string } {
  const setRawMode = vi.fn();
  const stdin = Object.assign(new PassThrough(), { isTTY: true, setRawMode }) as unknown as NodeJS.ReadStream;
  const output = new PassThrough();
  const chunks: string[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
  return { stdin, output, setRawMode, written: () => chunks.join('') };
}

describe('readHiddenLine', () => {
  it('reads a line from a terminal without echoing what is typed', async () => {
    const terminal = createTerminal();
    const reading = readHiddenLine({ stdin: terminal.stdin, output: terminal.output, prompt: PROMPT });
    terminal.stdin.push(`${LINK}\r`);

    expect(await reading).toBe(LINK);
    expect(terminal.written()).not.toContain('abc123');
    expect(terminal.written().startsWith(PROMPT)).toBe(true);
  });

  it('turns raw mode on while reading and off afterwards', async () => {
    const terminal = createTerminal();
    const reading = readHiddenLine({ stdin: terminal.stdin, output: terminal.output, prompt: PROMPT });
    terminal.stdin.push('x\n');
    await reading;

    expect(terminal.setRawMode.mock.calls).toEqual([[true], [false]]);
  });

  it('honours backspace', async () => {
    const terminal = createTerminal();
    const reading = readHiddenLine({ stdin: terminal.stdin, output: terminal.output, prompt: PROMPT });
    terminal.stdin.push(`abcd${BACKSPACE}${BACKSPACE}ef\r`);

    expect(await reading).toBe('abef');
  });

  it('rejects on Ctrl+C and restores the terminal', async () => {
    const terminal = createTerminal();
    const reading = readHiddenLine({ stdin: terminal.stdin, output: terminal.output, prompt: PROMPT });
    terminal.stdin.push(`abc${INTERRUPT}`);

    await expect(reading).rejects.toThrow('interrupted');
    expect(terminal.setRawMode.mock.calls.at(-1)).toEqual([false]);
  });

  it('reads a plain line when input is not a terminal', async () => {
    const stdin = new PassThrough() as unknown as NodeJS.ReadStream;
    const output = new PassThrough();
    const reading = readHiddenLine({ stdin, output, prompt: PROMPT });
    stdin.push(`${LINK}\n`);

    expect(await reading).toBe(LINK);
  });
});

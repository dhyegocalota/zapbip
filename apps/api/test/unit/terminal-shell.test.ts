import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createTerminalShell, type ShellProcess } from '../../src/operations/terminal-shell';

const SECRET_VALUE = 'distinctive-secret-value';
const WRANGLER_ARGUMENTS = ['wrangler', 'secret', 'put', 'META_APP_SECRET', '--env', 'staging'];

function fakeProcess(input: { stdout: string; exitCode: number | null }) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const child = Object.assign(new EventEmitter(), { stdin, stdout }) as ShellProcess;
  const written: string[] = [];
  stdin.on('data', (chunk: Buffer) => written.push(chunk.toString()));
  stdout.on('end', () => child.emit('close', input.exitCode));
  stdout.end(input.stdout);
  return { child, written };
}

function shellWith(input: { stdout?: string; exitCode?: number | null }) {
  const { stdout = '', exitCode = 0 } = input;
  const process = fakeProcess({ stdout, exitCode });
  const spawnProcess = vi.fn(() => process.child);
  const output: string[] = [];
  const shell = createTerminalShell({ spawnProcess, outputStream: { write: (chunk) => output.push(chunk) } });
  return { shell, spawnProcess, written: process.written, output };
}

describe('terminal shell', () => {
  it('spawns the file with the argument array unchanged', async () => {
    const { shell, spawnProcess } = shellWith({});
    await shell.run({ file: 'pnpm', args: WRANGLER_ARGUMENTS });
    expect(spawnProcess).toHaveBeenCalledWith({ file: 'pnpm', args: WRANGLER_ARGUMENTS });
  });

  it('writes the secret value to stdin and keeps it out of the arguments', async () => {
    const { shell, spawnProcess, written } = shellWith({});
    await shell.run({ file: 'pnpm', args: WRANGLER_ARGUMENTS, stdin: SECRET_VALUE });
    const [call] = spawnProcess.mock.calls as unknown as [[{ args: string[] }]];
    expect(call[0].args.join(' ')).not.toContain(SECRET_VALUE);
    expect(written.join('')).toBe(SECRET_VALUE);
  });

  it('returns the exit code and the captured output, and forwards the output', async () => {
    const { shell, output } = shellWith({ stdout: 'pending migrations', exitCode: 3 });
    expect(await shell.run({ file: 'pnpm', args: [] })).toEqual({ exitCode: 3, stdout: 'pending migrations' });
    expect(output.join('')).toBe('pending migrations');
  });

  it('reports a process killed by a signal as a failure', async () => {
    const { shell } = shellWith({ exitCode: null });
    const result = await shell.run({ file: 'pnpm', args: [] });
    expect(result.exitCode).not.toBe(0);
  });
});

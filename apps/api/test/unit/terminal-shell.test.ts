import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { SmokeInput } from '../../src/operations/smoke-inputs';
import { createTerminalShell, type ShellProcess } from '../../src/operations/terminal-shell';
import { WorkerSecret } from '../../src/operations/worker-secret';

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

function shellWith(input: { stdout?: string; exitCode?: number | null; environment?: Record<string, string | undefined> }) {
  const { stdout = '', exitCode = 0, environment = {} } = input;
  const process = fakeProcess({ stdout, exitCode });
  const spawnProcess = vi.fn(() => process.child);
  const output: string[] = [];
  const shell = createTerminalShell({ spawnProcess, environment, outputStream: { write: (chunk) => output.push(chunk) } });
  return { shell, spawnProcess, written: process.written, output };
}

describe('terminal shell', () => {
  it('spawns the file with the argument array unchanged', async () => {
    const { shell, spawnProcess } = shellWith({});
    await shell.run({ file: 'pnpm', args: WRANGLER_ARGUMENTS });
    expect(spawnProcess).toHaveBeenCalledWith(expect.objectContaining({ file: 'pnpm', args: WRANGLER_ARGUMENTS }));
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

  it('hands the child an environment without any Worker secret or smoke input, and keeps the rest', async () => {
    const secretNames = [...Object.values(WorkerSecret), ...Object.values(SmokeInput)];
    const environment = {
      ...Object.fromEntries(secretNames.map((name) => [name, `value-of-${name}`])),
      PATH: '/usr/bin',
      ZAPBIP_NPM_PUBLISHER: 'owner',
    };
    const { shell, spawnProcess } = shellWith({ environment });
    await shell.run({ file: 'pnpm', args: [] });
    const [spawnedWith] = spawnProcess.mock.calls[0] as unknown as [{ env: Record<string, string> }];
    expect(spawnedWith.env).toEqual({ PATH: '/usr/bin', ZAPBIP_NPM_PUBLISHER: 'owner' });
  });

  it('drops variables that are not set', async () => {
    const { shell, spawnProcess } = shellWith({ environment: { PATH: '/usr/bin', HOME: undefined } });
    await shell.run({ file: 'pnpm', args: [] });
    const [spawnedWith] = spawnProcess.mock.calls[0] as unknown as [{ env: Record<string, string> }];
    expect(spawnedWith.env).toEqual({ PATH: '/usr/bin' });
  });

  it('reports a process killed by a signal as a failure', async () => {
    const { shell } = shellWith({ exitCode: null });
    const result = await shell.run({ file: 'pnpm', args: [] });
    expect(result.exitCode).not.toBe(0);
  });
});

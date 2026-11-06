import { spawn } from 'node:child_process';
import type { EventEmitter } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import type { DeployShell } from './deploy-preflight';

const SIGNAL_EXIT_CODE = 1;

export type ShellProcess = EventEmitter & { stdin: Writable; stdout: Readable };
export type SpawnProcess = (input: { file: string; args: string[]; env: Record<string, string> }) => ShellProcess;
export type OutputStream = { write(chunk: string): unknown };

function spawnPiped(input: { file: string; args: string[]; env: Record<string, string> }): ShellProcess {
  return spawn(input.file, input.args, { stdio: ['pipe', 'pipe', 'inherit'], env: input.env });
}

export function createTerminalShell(input: {
  spawnProcess?: SpawnProcess;
  outputStream?: OutputStream;
  environment?: Record<string, string | undefined>;
}): DeployShell {
  const { spawnProcess = spawnPiped, outputStream = process.stdout } = input;
  return {
    run: ({ file, args, stdin }) =>
      new Promise((resolve, reject) => {
        const child = spawnProcess({ file, args, env: {} });
        const chunks: string[] = [];
        child.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          chunks.push(text);
          outputStream.write(text);
        });
        child.once('error', reject);
        child.once('close', (code: number | null) =>
          resolve({ exitCode: code === null ? SIGNAL_EXIT_CODE : code, stdout: chunks.join('') }),
        );
        child.stdin.end(stdin);
      }),
  };
}

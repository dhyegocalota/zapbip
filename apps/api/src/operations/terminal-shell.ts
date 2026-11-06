import type { EventEmitter } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import type { DeployShell } from './deploy-preflight';

export type ShellProcess = EventEmitter & { stdin: Writable; stdout: Readable };
export type SpawnProcess = (input: { file: string; args: string[] }) => ShellProcess;
export type OutputStream = { write(chunk: string): unknown };

export function createTerminalShell(input: { spawnProcess?: SpawnProcess; outputStream?: OutputStream }): DeployShell {
  void input;
  throw new Error('createTerminalShell is not implemented');
}

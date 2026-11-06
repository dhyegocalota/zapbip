import { spawn } from 'node:child_process';
import type { Message } from '@zapbip/core';
import {
  CONNECTION_URL_VARIABLE,
  CONNECTOR_KILL_GRACE_MS,
  CONNECTOR_WAKE_TIMEOUT_MS,
  ConnectorClient,
  type ConnectorSessionSource,
  ConnectorWakeOutcome,
} from '@zapbip/types';
import { buildOwnerPrompt } from './owner-prompt';
import { WAKE_ISOLATION_PREPARERS } from './wake-isolation';
import { buildCodexNewSessionArguments, CLIENT_BINARY_NAME, isActiveWriterRefusal, RESUME_ARGUMENT_BUILDERS } from './wake-commands';

type ChildResult = { exitCode: number | null; stderrText: string };
export type WakeResult = { outcome: ConnectorWakeOutcome; exitCode: number | null };

const CLEAN_EXIT_CODE = 0;

function childEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== CONNECTION_URL_VARIABLE));
}

function runChild(input: {
  client: ConnectorClient;
  clientArguments: string[];
  prompt: string;
  workingDirectory: string;
  signal?: AbortSignal;
}): Promise<ChildResult> {
  const { client, clientArguments, prompt, workingDirectory, signal } = input;
  return new Promise((resolve) => {
    const child = spawn(CLIENT_BINARY_NAME[client], clientArguments, {
      cwd: workingDirectory,
      env: childEnvironment(),
      stdio: ['pipe', 'pipe', 'pipe'],
      signal,
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(prompt);
    let stderrText = '';
    child.stdout.resume();
    child.stderr.on('data', (chunk: Buffer) => {
      stderrText += chunk.toString();
    });
    let killTimeout: NodeJS.Timeout | null = null;
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      killTimeout = setTimeout(() => child.kill('SIGKILL'), CONNECTOR_KILL_GRACE_MS);
    }, CONNECTOR_WAKE_TIMEOUT_MS);
    function clearTimeouts(): void {
      clearTimeout(timeout);
      if (killTimeout !== null) clearTimeout(killTimeout);
    }
    child.on('error', () => {
      clearTimeouts();
      resolve({ exitCode: null, stderrText });
    });
    child.on('close', (exitCode) => {
      clearTimeouts();
      resolve({ exitCode, stderrText });
    });
  });
}

function outcomeOf(input: { result: ChildResult; successOutcome: ConnectorWakeOutcome }): WakeResult {
  const { result, successOutcome } = input;
  if (result.exitCode === CLEAN_EXIT_CODE) return { outcome: successOutcome, exitCode: result.exitCode };
  return { outcome: ConnectorWakeOutcome.Failed, exitCode: result.exitCode };
}

export async function runWake(input: {
  client: ConnectorClient;
  connectionLink: string;
  sessionSource: ConnectorSessionSource;
  sessionId: string | null;
  message: Message;
  workingDirectory: string;
  signal?: AbortSignal;
}): Promise<WakeResult> {
  const { client, connectionLink, sessionId, message, workingDirectory, signal } = input;
  if (sessionId === null) return { outcome: ConnectorWakeOutcome.NoSession, exitCode: null };
  const prompt = buildOwnerPrompt({ message });
  const { isolationArguments, cleanup } = await WAKE_ISOLATION_PREPARERS[client]({
    connectionLink,
    workingDirectory,
    codexHome: process.env.CODEX_HOME,
  });
  try {
    return await wakeWithin({ client, sessionId, prompt, isolationArguments, workingDirectory, signal });
  } finally {
    await cleanup();
  }
}

async function wakeWithin(input: {
  client: ConnectorClient;
  sessionId: string;
  prompt: string;
  isolationArguments: string[];
  workingDirectory: string;
  signal?: AbortSignal;
}): Promise<WakeResult> {
  const { client, sessionId, prompt, isolationArguments, workingDirectory, signal } = input;
  const resumed = await runChild({
    client,
    clientArguments: RESUME_ARGUMENT_BUILDERS[client]({ sessionId, isolationArguments }),
    prompt,
    workingDirectory,
    signal,
  });
  const isActiveWriterOnCodex = client === ConnectorClient.Codex && isActiveWriterRefusal({ stderrText: resumed.stderrText });
  if (!isActiveWriterOnCodex) return outcomeOf({ result: resumed, successOutcome: ConnectorWakeOutcome.Answered });
  const fallback = await runChild({
    client,
    clientArguments: buildCodexNewSessionArguments({ isolationArguments }),
    prompt,
    workingDirectory,
    signal,
  });
  return outcomeOf({ result: fallback, successOutcome: ConnectorWakeOutcome.FallbackNewThread });
}

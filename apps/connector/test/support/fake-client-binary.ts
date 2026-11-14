import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONNECTOR_RUNTIMES, ConnectorClient } from '@zapbip/agents/connector';
import { vi } from 'vitest';
import { CONNECTOR_CLIENTS } from './connector-clients';

const SUPPORTED_DIRECTORY = fileURLToPath(new URL('../../../../libs/agents/supported', import.meta.url));
const FAKE_BINARY_FOLDER = 'testing';
const FAKE_CLIENT_ENTRY = 'fake-client.mjs';
const BINARY_DIRECTORY_NAME = 'bin';
const EXECUTABLE_MODE = 0o755;
const SESSION_WRITER_FILE = 'write-session.mjs';
const DECOY_WRITER_FILE = 'write-decoy.mjs';
const MILLISECONDS_PER_SECOND = 1000;
export const ACTIVE_WRITER_TEXT = 'Error: thread already has an active writer for this session';

type SessionWriter = (input: {
  homeDirectory: string;
  workingDirectory: string;
  sessionId: string;
  modifiedAtSeconds: number;
}) => Promise<void>;
const HOLD_RELEASE_TEXT = 'release';

export type FakeClientBehavior = {
  exitCode?: number;
  output?: string;
  refuseResume?: boolean;
  refuseAll?: boolean;
  refuseSession?: string;
  hang?: boolean;
  ignoreSigterm?: boolean;
  runMs?: number;
  holdUntilFile?: string;
  rolloutSessionId?: string;
};

export type FakeClientRun = {
  pid: number;
  clientName: string;
  argv: string[];
  cwd: string;
  stdin: string;
  hadConnectionUrl: boolean;
  mcpConfig: { text: string; mode: number } | null;
  probe: string | null;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  signal: string | null;
};

type RecordLine = {
  pid: number;
  clientName: string;
  argv: string[];
  cwd: string;
  stdin?: string;
  hadConnectionUrl?: boolean;
  mcpConfig?: { text: string; mode: number } | null;
  probe?: string | null;
  at: number;
  event: 'started' | 'ended';
  exitCode?: number | null;
  signal?: string | null;
};

export type FakeClients = {
  rootDirectory: string;
  workingDirectory: string;
  homeDirectoryOf: (input: { client: ConnectorClient }) => string;
  recordFile: string;
  holdFile: string;
  environment: (input: { behavior: FakeClientBehavior }) => Record<string, string>;
  apply: (input: { behavior: FakeClientBehavior }) => void;
  release: () => Promise<void>;
  readRuns: () => Promise<FakeClientRun[]>;
  writeSession: (input: { client: ConnectorClient; sessionId: string; modifiedAtSeconds?: number }) => Promise<void>;
  writeDecoy: (input: { client: ConnectorClient; name: string; url: string }) => Promise<void>;
  writeCommand: (input: { client: ConnectorClient; name: string }) => Promise<void>;
  cleanup: () => Promise<void>;
};

const BEHAVIOR_VARIABLES: Record<keyof FakeClientBehavior, (value: never) => [string, string]> = {
  exitCode: (value: number) => ['FAKE_CLIENT_EXIT_CODE', String(value)],
  output: (value: string) => ['FAKE_CLIENT_OUTPUT', value],
  refuseResume: (value: boolean) => ['FAKE_CLIENT_REFUSE_RESUME', value ? '1' : '0'],
  refuseAll: (value: boolean) => ['FAKE_CLIENT_REFUSE_ALL', value ? '1' : '0'],
  refuseSession: (value: string) => ['FAKE_CLIENT_REFUSE_SESSION', value],
  hang: (value: boolean) => ['FAKE_CLIENT_HANG', value ? '1' : '0'],
  ignoreSigterm: (value: boolean) => ['FAKE_CLIENT_IGNORE_SIGTERM', value ? '1' : '0'],
  runMs: (value: number) => ['FAKE_CLIENT_RUN_MS', String(value)],
  holdUntilFile: (value: string) => ['FAKE_CLIENT_HOLD_FILE', value],
  rolloutSessionId: (value: string) => ['FAKE_CLIENT_ROLLOUT_SESSION_ID', value],
};

function behaviorEnvironment(input: { behavior: FakeClientBehavior }): Record<string, string> {
  const entries = Object.entries(input.behavior).map(([key, value]) => BEHAVIOR_VARIABLES[key as keyof FakeClientBehavior](value as never));
  return Object.fromEntries(entries);
}

function mergeRuns(input: { lines: RecordLine[] }): FakeClientRun[] {
  const started = input.lines.filter((line) => line.event === 'started');
  return started.map((line) => {
    const ended = input.lines.find((candidate) => candidate.event === 'ended' && candidate.pid === line.pid);
    return {
      pid: line.pid,
      clientName: line.clientName,
      argv: line.argv,
      cwd: line.cwd,
      stdin: line.stdin === undefined ? '' : line.stdin,
      hadConnectionUrl: line.hadConnectionUrl === true,
      mcpConfig: line.mcpConfig === undefined ? null : line.mcpConfig,
      probe: line.probe === undefined ? null : line.probe,
      startedAt: line.at,
      endedAt: ended === undefined ? null : ended.at,
      exitCode: ended === undefined || ended.exitCode === undefined ? null : ended.exitCode,
      signal: ended === undefined || ended.signal === undefined ? null : ended.signal,
    };
  });
}

export function runAt(input: { runs: FakeClientRun[]; index: number }): FakeClientRun {
  const run = input.runs[input.index];
  if (run === undefined) throw new Error(`no fake client run at index ${input.index}`);
  return run;
}

async function writeBinary(input: { binaryDirectory: string; name: string; client: ConnectorClient }): Promise<void> {
  const entry = pathToFileURL(join(SUPPORTED_DIRECTORY, input.client, FAKE_BINARY_FOLDER, FAKE_CLIENT_ENTRY)).href;
  const binary = join(input.binaryDirectory, input.name);
  await writeFile(binary, `#!/usr/bin/env node\nimport(${JSON.stringify(entry)});\n`);
  await chmod(binary, EXECUTABLE_MODE);
}

async function writeBinaries(input: { rootDirectory: string }): Promise<string> {
  const binaryDirectory = join(input.rootDirectory, BINARY_DIRECTORY_NAME);
  await mkdir(binaryDirectory, { recursive: true });
  await Promise.all(
    CONNECTOR_CLIENTS.map((client) => writeBinary({ binaryDirectory, name: CONNECTOR_RUNTIMES[client].binaryName, client })),
  );
  return binaryDirectory;
}

export async function createFakeClients(): Promise<FakeClients> {
  const rootDirectory = await realpath(await mkdtemp(join(tmpdir(), 'zapbip-fake-clients-')));
  const workingDirectory = join(rootDirectory, 'project');
  const homeDirectories = Object.fromEntries(CONNECTOR_CLIENTS.map((client) => [client, join(rootDirectory, `${client}-home`)]));
  const recordFile = join(rootDirectory, 'record.jsonl');
  const holdFile = join(rootDirectory, 'hold-release');
  await mkdir(workingDirectory, { recursive: true });
  await writeFile(recordFile, '');
  const binaryDirectory = await writeBinaries({ rootDirectory });

  const baseEnvironment: Record<string, string> = {
    PATH: [binaryDirectory, process.env.PATH].join(delimiter),
    ...Object.fromEntries(CONNECTOR_CLIENTS.map((client) => [CONNECTOR_RUNTIMES[client].homeVariable, homeDirectories[client]])),
    FAKE_CLIENT_RECORD: recordFile,
  };

  function environment(input: { behavior: FakeClientBehavior }): Record<string, string> {
    return { ...baseEnvironment, ...behaviorEnvironment({ behavior: input.behavior }) };
  }

  function apply(input: { behavior: FakeClientBehavior }): void {
    Object.entries(environment({ behavior: input.behavior })).forEach(([name, value]) => vi.stubEnv(name, value));
  }

  async function release(): Promise<void> {
    await writeFile(holdFile, HOLD_RELEASE_TEXT);
  }

  async function readRuns(): Promise<FakeClientRun[]> {
    const text = await readFile(recordFile, 'utf8');
    const lines = text
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as RecordLine);
    return mergeRuns({ lines });
  }

  function homeDirectoryOf(input: { client: ConnectorClient }): string {
    return homeDirectories[input.client] as string;
  }

  async function writeSession(input: { client: ConnectorClient; sessionId: string; modifiedAtSeconds?: number }): Promise<void> {
    const { writeSession: writer } = (await import(join(SUPPORTED_DIRECTORY, input.client, FAKE_BINARY_FOLDER, SESSION_WRITER_FILE))) as {
      writeSession: SessionWriter;
    };
    const { client, sessionId, modifiedAtSeconds = Math.floor(Date.now() / MILLISECONDS_PER_SECOND) } = input;
    await writer({ homeDirectory: homeDirectoryOf({ client }), workingDirectory, sessionId, modifiedAtSeconds });
  }

  async function writeDecoy(input: { client: ConnectorClient; name: string; url: string }): Promise<void> {
    const { writeDecoy: writer } = (await import(join(SUPPORTED_DIRECTORY, input.client, FAKE_BINARY_FOLDER, DECOY_WRITER_FILE))) as {
      writeDecoy: (decoy: { homeDirectory: string; name: string; url: string }) => Promise<void>;
    };
    await writer({ homeDirectory: homeDirectoryOf({ client: input.client }), name: input.name, url: input.url });
  }

  async function writeCommand(input: { client: ConnectorClient; name: string }): Promise<void> {
    await writeBinary({ binaryDirectory, name: input.name, client: input.client });
  }

  async function cleanup(): Promise<void> {
    await rm(rootDirectory, { recursive: true, force: true });
  }

  return {
    rootDirectory,
    workingDirectory,
    homeDirectoryOf,
    recordFile,
    holdFile,
    environment,
    apply,
    release,
    readRuns,
    writeSession,
    writeDecoy,
    writeCommand,
    cleanup,
  };
}

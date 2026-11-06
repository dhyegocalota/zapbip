import { mkdir, mkdtemp, readFile, realpath, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

const FIXTURE_BIN_DIRECTORY = fileURLToPath(new URL('../fixtures/bin', import.meta.url));
const CLAUDE_FOLDER_UNSAFE_CHARACTERS = /[^A-Za-z0-9]/g;
const CLAUDE_FOLDER_REPLACEMENT = '-';
const HOLD_RELEASE_TEXT = 'release';

export type FakeClientBehavior = {
  exitCode?: number;
  output?: string;
  refuseResume?: boolean;
  refuseAll?: boolean;
  refuseSession?: string;
  hang?: boolean;
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
  at: number;
  event: 'started' | 'ended';
  exitCode?: number | null;
  signal?: string | null;
};

export type FakeClients = {
  rootDirectory: string;
  workingDirectory: string;
  claudeConfigDirectory: string;
  codexHome: string;
  recordFile: string;
  holdFile: string;
  environment: (input: { behavior: FakeClientBehavior }) => Record<string, string>;
  apply: (input: { behavior: FakeClientBehavior }) => void;
  release: () => Promise<void>;
  readRuns: () => Promise<FakeClientRun[]>;
  writeClaudeSession: (input: { sessionId: string }) => Promise<void>;
  writeCodexRollout: (input: { sessionId: string; modifiedAtSeconds: number }) => Promise<void>;
  cleanup: () => Promise<void>;
};

const BEHAVIOR_VARIABLES: Record<keyof FakeClientBehavior, (value: never) => [string, string]> = {
  exitCode: (value: number) => ['FAKE_CLIENT_EXIT_CODE', String(value)],
  output: (value: string) => ['FAKE_CLIENT_OUTPUT', value],
  refuseResume: (value: boolean) => ['FAKE_CLIENT_REFUSE_RESUME', value ? '1' : '0'],
  refuseAll: (value: boolean) => ['FAKE_CLIENT_REFUSE_ALL', value ? '1' : '0'],
  refuseSession: (value: string) => ['FAKE_CLIENT_REFUSE_SESSION', value],
  hang: (value: boolean) => ['FAKE_CLIENT_HANG', value ? '1' : '0'],
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

export async function createFakeClients(): Promise<FakeClients> {
  const rootDirectory = await realpath(await mkdtemp(join(tmpdir(), 'zapbip-fake-clients-')));
  const workingDirectory = join(rootDirectory, 'project');
  const claudeConfigDirectory = join(rootDirectory, 'claude-config');
  const codexHome = join(rootDirectory, 'codex-home');
  const recordFile = join(rootDirectory, 'record.jsonl');
  const holdFile = join(rootDirectory, 'hold-release');
  await mkdir(workingDirectory, { recursive: true });
  await writeFile(recordFile, '');

  const baseEnvironment: Record<string, string> = {
    PATH: `${FIXTURE_BIN_DIRECTORY}${delimiter}${process.env.PATH}`,
    CLAUDE_CONFIG_DIR: claudeConfigDirectory,
    CODEX_HOME: codexHome,
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

  async function writeClaudeSession(input: { sessionId: string }): Promise<void> {
    const projectFolder = join(
      claudeConfigDirectory,
      'projects',
      workingDirectory.replace(CLAUDE_FOLDER_UNSAFE_CHARACTERS, CLAUDE_FOLDER_REPLACEMENT),
    );
    await mkdir(projectFolder, { recursive: true });
    await writeFile(join(projectFolder, `${input.sessionId}.jsonl`), '{}\n');
  }

  async function writeCodexRollout(input: { sessionId: string; modifiedAtSeconds: number }): Promise<void> {
    const directory = join(codexHome, 'sessions', '2020', '01', '01');
    const file = join(directory, `rollout-2020-01-01T00-00-00-${input.sessionId}.jsonl`);
    await mkdir(directory, { recursive: true });
    await writeFile(file, `${JSON.stringify({ type: 'session_meta', payload: { id: input.sessionId, cwd: workingDirectory } })}\n`);
    await utimes(file, input.modifiedAtSeconds, input.modifiedAtSeconds);
  }

  async function cleanup(): Promise<void> {
    await rm(rootDirectory, { recursive: true, force: true });
  }

  return {
    rootDirectory,
    workingDirectory,
    claudeConfigDirectory,
    codexHome,
    recordFile,
    holdFile,
    environment,
    apply,
    release,
    readRuns,
    writeClaudeSession,
    writeCodexRollout,
    cleanup,
  };
}

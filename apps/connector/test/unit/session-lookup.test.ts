import { cp, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConnectorClient, SESSION_LOOKUP_LIMIT } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { claudeProjectFolderName, findNewestSessionId } from '../../src/session-lookup';

const FIXTURE_DIRECTORY = join(import.meta.dirname, '..', 'fixtures', 'claude-folder');
const FIXTURE_WORKING_DIRECTORY = '/private/tmp/doctor-walk';
const FIXTURE_FOLDER_NAME = '-private-tmp-doctor-walk';
const OLDEST_SESSION_ID = '0ff172bc-aa4e-4181-989c-3837345aa2cd';
const MIDDLE_SESSION_ID = '3c69d8d0-4556-40ca-a764-073324f7ec44';
const NEWEST_SESSION_ID = '50be37b9-5296-4b9d-8b1c-9991825f268d';
const WORKING_DIRECTORY = '/Users/maria/work/api';
const OTHER_DIRECTORY = '/Users/maria/work/web';
const FIRST_SECOND = 1_700_000_000;

let rootDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'zapbip-session-lookup-'));
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

function sessionIdAt(input: { index: number }): string {
  return `00000000-0000-4000-8000-${String(input.index).padStart(12, '0')}`;
}

async function copyClaudeFixture(): Promise<string> {
  const claudeConfigDirectory = join(rootDirectory, 'claude');
  await cp(FIXTURE_DIRECTORY, join(claudeConfigDirectory, 'projects'), { recursive: true });
  return claudeConfigDirectory;
}

async function touchClaudeSession(input: { claudeConfigDirectory: string; sessionId: string; second: number }): Promise<void> {
  const path = join(input.claudeConfigDirectory, 'projects', FIXTURE_FOLDER_NAME, `${input.sessionId}.jsonl`);
  await utimes(path, input.second, input.second);
}

async function writeRollout(input: { day: string; sessionId: string; workingDirectory: string; first?: string }): Promise<void> {
  const [year, month, dayOfMonth] = input.day.split('-');
  const folder = join(rootDirectory, 'codex', 'sessions', `${year}`, `${month}`, `${dayOfMonth}`);
  await mkdir(folder, { recursive: true });
  const meta = JSON.stringify({ type: 'session_meta', payload: { id: input.sessionId, cwd: input.workingDirectory } });
  const firstLine = input.first === undefined ? meta : input.first;
  const body = `${firstLine}\n${JSON.stringify({ type: 'event_msg', payload: { cwd: WORKING_DIRECTORY } })}\n`;
  await writeFile(join(folder, `rollout-${input.day}T10-00-00-${input.sessionId}.jsonl`), body);
}

function findCodexSession(input: { workingDirectory: string }): Promise<string | null> {
  return findNewestSessionId({
    client: ConnectorClient.Codex,
    workingDirectory: input.workingDirectory,
    codexHome: join(rootDirectory, 'codex'),
  });
}

describe('claudeProjectFolderName', () => {
  test('replaces every character that is not a letter or digit with a dash, as a real install names its folders', () => {
    expect(claudeProjectFolderName({ workingDirectory: FIXTURE_WORKING_DIRECTORY })).toBe(FIXTURE_FOLDER_NAME);
  });

  test('replaces dots, underscores and spaces too', () => {
    expect(claudeProjectFolderName({ workingDirectory: '/Users/maria/my.project_1 x' })).toBe('-Users-maria-my-project-1-x');
  });
});

describe('findNewestSessionId for Claude Code', () => {
  test('returns the session file with the latest modification time, not the latest name', async () => {
    const claudeConfigDirectory = await copyClaudeFixture();
    await touchClaudeSession({ claudeConfigDirectory, sessionId: NEWEST_SESSION_ID, second: FIRST_SECOND });
    await touchClaudeSession({ claudeConfigDirectory, sessionId: MIDDLE_SESSION_ID, second: FIRST_SECOND + 10 });
    await touchClaudeSession({ claudeConfigDirectory, sessionId: OLDEST_SESSION_ID, second: FIRST_SECOND + 20 });
    const sessionId = await findNewestSessionId({
      client: ConnectorClient.ClaudeCode,
      workingDirectory: FIXTURE_WORKING_DIRECTORY,
      claudeConfigDirectory,
    });
    expect(sessionId).toBe(OLDEST_SESSION_ID);
  });

  test('picks up a session written after an earlier lookup', async () => {
    const claudeConfigDirectory = await copyClaudeFixture();
    await touchClaudeSession({ claudeConfigDirectory, sessionId: OLDEST_SESSION_ID, second: FIRST_SECOND });
    await touchClaudeSession({ claudeConfigDirectory, sessionId: MIDDLE_SESSION_ID, second: FIRST_SECOND });
    await touchClaudeSession({ claudeConfigDirectory, sessionId: NEWEST_SESSION_ID, second: FIRST_SECOND + 30 });
    const sessionId = await findNewestSessionId({
      client: ConnectorClient.ClaudeCode,
      workingDirectory: FIXTURE_WORKING_DIRECTORY,
      claudeConfigDirectory,
    });
    expect(sessionId).toBe(NEWEST_SESSION_ID);
  });

  test('returns null when the directory has no project folder', async () => {
    const claudeConfigDirectory = await copyClaudeFixture();
    const sessionId = await findNewestSessionId({
      client: ConnectorClient.ClaudeCode,
      workingDirectory: OTHER_DIRECTORY,
      claudeConfigDirectory,
    });
    expect(sessionId).toBeNull();
  });

  test('returns null when the project folder has no session file', async () => {
    const claudeConfigDirectory = join(rootDirectory, 'claude');
    await mkdir(join(claudeConfigDirectory, 'projects', claudeProjectFolderName({ workingDirectory: WORKING_DIRECTORY })), {
      recursive: true,
    });
    const sessionId = await findNewestSessionId({
      client: ConnectorClient.ClaudeCode,
      workingDirectory: WORKING_DIRECTORY,
      claudeConfigDirectory,
    });
    expect(sessionId).toBeNull();
  });

  test('ignores files that are not a session id with the jsonl extension', async () => {
    const claudeConfigDirectory = join(rootDirectory, 'claude');
    const folder = join(claudeConfigDirectory, 'projects', claudeProjectFolderName({ workingDirectory: WORKING_DIRECTORY }));
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, '--dangerous.jsonl'), '');
    await writeFile(join(folder, `${NEWEST_SESSION_ID}.txt`), '');
    const sessionId = await findNewestSessionId({
      client: ConnectorClient.ClaudeCode,
      workingDirectory: WORKING_DIRECTORY,
      claudeConfigDirectory,
    });
    expect(sessionId).toBeNull();
  });
});

describe('findNewestSessionId for Codex', () => {
  test('returns the newest rollout whose session_meta records the directory', async () => {
    await writeRollout({ day: '2026-11-04', sessionId: OLDEST_SESSION_ID, workingDirectory: WORKING_DIRECTORY });
    await writeRollout({ day: '2026-11-06', sessionId: NEWEST_SESSION_ID, workingDirectory: WORKING_DIRECTORY });
    await writeRollout({ day: '2026-11-05', sessionId: MIDDLE_SESSION_ID, workingDirectory: WORKING_DIRECTORY });
    expect(await findCodexSession({ workingDirectory: WORKING_DIRECTORY })).toBe(NEWEST_SESSION_ID);
  });

  test('skips a newer rollout whose first line records another directory, whatever its later lines say', async () => {
    await writeRollout({ day: '2026-11-04', sessionId: OLDEST_SESSION_ID, workingDirectory: WORKING_DIRECTORY });
    await writeRollout({ day: '2026-11-06', sessionId: NEWEST_SESSION_ID, workingDirectory: OTHER_DIRECTORY });
    expect(await findCodexSession({ workingDirectory: WORKING_DIRECTORY })).toBe(OLDEST_SESSION_ID);
  });

  test('skips a rollout whose first line is not JSON', async () => {
    await writeRollout({ day: '2026-11-04', sessionId: OLDEST_SESSION_ID, workingDirectory: WORKING_DIRECTORY });
    await writeRollout({ day: '2026-11-06', sessionId: NEWEST_SESSION_ID, workingDirectory: WORKING_DIRECTORY, first: '{not json' });
    expect(await findCodexSession({ workingDirectory: WORKING_DIRECTORY })).toBe(OLDEST_SESSION_ID);
  });

  test('skips a rollout whose recorded id is not a UUID', async () => {
    await writeRollout({ day: '2026-11-06', sessionId: '--dangerous', workingDirectory: WORKING_DIRECTORY });
    expect(await findCodexSession({ workingDirectory: WORKING_DIRECTORY })).toBeNull();
  });

  test('returns null when there are no sessions', async () => {
    expect(await findCodexSession({ workingDirectory: WORKING_DIRECTORY })).toBeNull();
  });

  test('stops after the lookup limit', async () => {
    await writeRollout({ day: '2026-10-01', sessionId: OLDEST_SESSION_ID, workingDirectory: WORKING_DIRECTORY });
    const newerRollouts = Array.from({ length: SESSION_LOOKUP_LIMIT }, (_, index) =>
      writeRollout({ day: '2026-11-06', sessionId: sessionIdAt({ index }), workingDirectory: OTHER_DIRECTORY }),
    );
    await Promise.all(newerRollouts);
    expect(await findCodexSession({ workingDirectory: WORKING_DIRECTORY })).toBeNull();
  });

  test('finds a match inside the lookup limit', async () => {
    const rollouts = Array.from({ length: SESSION_LOOKUP_LIMIT - 1 }, (_, index) =>
      writeRollout({ day: '2026-11-06', sessionId: sessionIdAt({ index }), workingDirectory: OTHER_DIRECTORY }),
    );
    await Promise.all(rollouts);
    await writeRollout({ day: '2026-10-01', sessionId: OLDEST_SESSION_ID, workingDirectory: WORKING_DIRECTORY });
    expect(await findCodexSession({ workingDirectory: WORKING_DIRECTORY })).toBe(OLDEST_SESSION_ID);
  });
});

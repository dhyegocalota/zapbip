import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { runtime } from './connector';

const SESSION_FOLDER = '.fixture-sessions';
const FAKE_BINARY = join(import.meta.dirname, 'testing', 'fixture-binary.mjs');
const OLDER_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const NEWER_SESSION_ID = '00000000-0000-4000-8000-000000000002';

const execute = promisify(execFile);
let workingDirectory = '';

beforeEach(async () => {
  workingDirectory = await mkdtemp(join(tmpdir(), 'fixture-connector-'));
});

afterEach(async () => {
  await rm(workingDirectory, { recursive: true, force: true });
});

describe('the fixture connector runtime', () => {
  test('finds the newest session id', async () => {
    await mkdir(join(workingDirectory, SESSION_FOLDER));
    await writeFile(join(workingDirectory, SESSION_FOLDER, OLDER_SESSION_ID), '');
    await writeFile(join(workingDirectory, SESSION_FOLDER, NEWER_SESSION_ID), '');
    const sessionId = await runtime.findNewestSessionId({
      workingDirectory,
      claudeConfigDirectory: workingDirectory,
      codexHome: workingDirectory,
    });
    expect(sessionId).toBe(NEWER_SESSION_ID);
  });

  test('finds no session id when there is no session folder', async () => {
    const sessionId = await runtime.findNewestSessionId({
      workingDirectory,
      claudeConfigDirectory: workingDirectory,
      codexHome: workingDirectory,
    });
    expect(sessionId).toBeNull();
  });

  test('prepares isolation arguments and cleans up', async () => {
    const isolation = await runtime.prepareIsolation({ connectionLink: 'https://x.example/c/zb_conn_FAKE/mcp', workingDirectory });
    expect(isolation.isolationArguments).toEqual(['--isolated']);
    await expect(isolation.cleanup()).resolves.toBeUndefined();
  });

  test('resumes a session through the fake binary with the isolation arguments last', async () => {
    const resumeArguments = runtime.resumeArguments({ sessionId: NEWER_SESSION_ID, isolationArguments: ['--isolated'] });
    const { stdout } = await execute(process.execPath, [FAKE_BINARY, ...resumeArguments]);
    expect(JSON.parse(stdout)).toEqual(['--resume', NEWER_SESSION_ID, '--isolated']);
  });

  test('starts a new session when the runtime offers one', () => {
    expect(runtime.newSessionArguments?.({ isolationArguments: ['--isolated'] })).toEqual(['--new', '--isolated']);
  });

  test('falls back to a new session only on its own refusal message', () => {
    expect(runtime.isNewSessionFallback({ stderrText: 'error: fixture session is busy' })).toBe(true);
    expect(runtime.isNewSessionFallback({ stderrText: 'error: something else' })).toBe(false);
  });
});

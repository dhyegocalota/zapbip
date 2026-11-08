import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { runtime } from './connector';

const OLDER_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const NEWER_SESSION_ID = '00000000-0000-4000-8000-000000000002';
const CONNECTION_LINK = 'https://x.example/c/zb_conn_FAKE/mcp';
const OWNER_ONLY_MODE = 0o600;
const CONFIG_ARGUMENT = '--mcp-config=';

let homeDirectory = '';

beforeEach(async () => {
  homeDirectory = await mkdtemp(join(tmpdir(), 'fixture-connector-'));
});

afterEach(async () => {
  await rm(homeDirectory, { recursive: true, force: true });
});

async function writeSession(input: { sessionId: string; modifiedAtSeconds: number }): Promise<void> {
  await mkdir(join(homeDirectory, 'sessions'), { recursive: true });
  const file = join(homeDirectory, 'sessions', input.sessionId);
  await writeFile(file, '');
  await utimes(file, input.modifiedAtSeconds, input.modifiedAtSeconds);
}

describe('the fixture connector runtime', () => {
  test('finds the session written last, not the one named last', async () => {
    await writeSession({ sessionId: NEWER_SESSION_ID, modifiedAtSeconds: 1 });
    await writeSession({ sessionId: OLDER_SESSION_ID, modifiedAtSeconds: 2 });
    expect(await runtime.findNewestSessionId({ workingDirectory: homeDirectory, homeDirectory })).toBe(OLDER_SESSION_ID);
  });

  test('finds no session id when there is no session folder', async () => {
    expect(await runtime.findNewestSessionId({ workingDirectory: homeDirectory, homeDirectory })).toBeNull();
  });

  test('pins one MCP server with a strict flag, a private file and a cleanup', async () => {
    const { isolationArguments, cleanup } = await runtime.prepareIsolation({
      connectionLink: CONNECTION_LINK,
      workingDirectory: homeDirectory,
      homeDirectory,
    });
    const configArgument = isolationArguments.find((argument) => argument.startsWith(CONFIG_ARGUMENT)) as string;
    const configFile = configArgument.slice(CONFIG_ARGUMENT.length);
    expect(isolationArguments).toContain(runtime.strictMcpArgument);
    expect(JSON.parse(await readFile(configFile, 'utf8'))).toEqual({ mcpServers: { zapbip: { type: 'http', url: CONNECTION_LINK } } });
    expect((await stat(configFile)).mode & 0o777).toBe(OWNER_ONLY_MODE);
    await cleanup();
    await expect(stat(configFile)).rejects.toThrow();
  });

  test('resumes a session with the isolation arguments last', () => {
    expect(runtime.resumeArguments({ sessionId: NEWER_SESSION_ID, isolationArguments: ['--a'] })).toEqual([
      'resume',
      NEWER_SESSION_ID,
      '--a',
    ]);
  });

  test('starts a new session with the isolation arguments only', () => {
    expect(runtime.newSessionArguments?.({ isolationArguments: ['--a'] })).toEqual(['--a']);
  });

  test('falls back to a new session only on its own refusal message', () => {
    expect(runtime.isNewSessionFallback({ stderrText: 'Error: thread already has an active writer for this session' })).toBe(true);
    expect(runtime.isNewSessionFallback({ stderrText: 'error: something else' })).toBe(false);
  });
});

import { access, cp, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { claudeProjectFolderName, runtime } from './connector';

const FIXTURE_DIRECTORY = join(import.meta.dirname, 'testing', 'claude-folder');
const FIXTURE_WORKING_DIRECTORY = '/private/tmp/doctor-walk';
const FIXTURE_FOLDER_NAME = '-private-tmp-doctor-walk';
const OLDEST_SESSION_ID = '0ff172bc-aa4e-4181-989c-3837345aa2cd';
const MIDDLE_SESSION_ID = '3c69d8d0-4556-40ca-a764-073324f7ec44';
const NEWEST_SESSION_ID = '50be37b9-5296-4b9d-8b1c-9991825f268d';
const WORKING_DIRECTORY = '/Users/maria/work/api';
const OTHER_DIRECTORY = '/Users/maria/work/web';
const FIRST_SECOND = 1_700_000_000;
const CONNECTION_LINK = 'https://zapbip.example/c/secret-abc/mcp';
const OWNER_ONLY_MODE = 0o600;
const MODE_MASK = 0o777;
const MCP_CONFIG_PREFIX = '--mcp-config=';
const SESSION_ID = '0ff172bc-aa4e-4181-989c-3837345aa2cd';
const CLAUDE_ISOLATION_ARGUMENTS = ['--strict-mcp-config', '--mcp-config=/private/zapbip-wake/mcp.json', '--setting-sources='];

let rootDirectory: string;
let workingDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'zapbip-claude-code-connector-'));
  workingDirectory = join(rootDirectory, 'project');
  await mkdir(workingDirectory, { recursive: true });
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

async function copyClaudeFixture(): Promise<string> {
  const claudeConfigDirectory = join(rootDirectory, 'claude');
  await cp(FIXTURE_DIRECTORY, join(claudeConfigDirectory, 'projects'), { recursive: true });
  return claudeConfigDirectory;
}

async function touchClaudeSession(input: { claudeConfigDirectory: string; sessionId: string; second: number }): Promise<void> {
  const path = join(input.claudeConfigDirectory, 'projects', FIXTURE_FOLDER_NAME, `${input.sessionId}.jsonl`);
  await utimes(path, input.second, input.second);
}

function findClaudeSession(input: { workingDirectory: string; claudeConfigDirectory: string }): Promise<string | null> {
  return runtime.findNewestSessionId({ ...input, codexHome: join(rootDirectory, 'codex') });
}

describe('the claude binary', () => {
  test('is named claude', () => {
    expect(runtime.binaryName).toBe('claude');
  });
});

describe('claudeProjectFolderName', () => {
  test('replaces every character that is not a letter or digit with a dash, as a real install names its folders', () => {
    expect(claudeProjectFolderName({ workingDirectory: FIXTURE_WORKING_DIRECTORY })).toBe(FIXTURE_FOLDER_NAME);
  });

  test('replaces dots, underscores and spaces too', () => {
    expect(claudeProjectFolderName({ workingDirectory: '/Users/maria/my.project_1 x' })).toBe('-Users-maria-my-project-1-x');
  });
});

describe('findNewestSessionId', () => {
  test('returns the session file with the latest modification time, not the latest name', async () => {
    const claudeConfigDirectory = await copyClaudeFixture();
    await touchClaudeSession({ claudeConfigDirectory, sessionId: NEWEST_SESSION_ID, second: FIRST_SECOND });
    await touchClaudeSession({ claudeConfigDirectory, sessionId: MIDDLE_SESSION_ID, second: FIRST_SECOND + 10 });
    await touchClaudeSession({ claudeConfigDirectory, sessionId: OLDEST_SESSION_ID, second: FIRST_SECOND + 20 });
    const sessionId = await findClaudeSession({
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
    const sessionId = await findClaudeSession({
      workingDirectory: FIXTURE_WORKING_DIRECTORY,
      claudeConfigDirectory,
    });
    expect(sessionId).toBe(NEWEST_SESSION_ID);
  });

  test('returns null when the directory has no project folder', async () => {
    const claudeConfigDirectory = await copyClaudeFixture();
    const sessionId = await findClaudeSession({
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
    const sessionId = await findClaudeSession({
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
    const sessionId = await findClaudeSession({
      workingDirectory: WORKING_DIRECTORY,
      claudeConfigDirectory,
    });
    expect(sessionId).toBeNull();
  });
});

describe('resumeArguments', () => {
  test('resumes the session in dontAsk mode with every built-in tool off, only the zapbip server and only send_message allowed', () => {
    expect(runtime.resumeArguments({ sessionId: SESSION_ID, isolationArguments: CLAUDE_ISOLATION_ARGUMENTS })).toEqual([
      '-p',
      '--resume',
      SESSION_ID,
      '--permission-mode',
      'dontAsk',
      '--tools=',
      '--strict-mcp-config',
      '--mcp-config=/private/zapbip-wake/mcp.json',
      '--setting-sources=',
      '--allowedTools=mcp__zapbip__send_message',
    ]);
  });

  test('rejects a session id that is not a UUID', () => {
    expect(() => runtime.resumeArguments({ sessionId: '--dangerously-skip-permissions', isolationArguments: [] })).toThrow(
      'session id is not a UUID',
    );
  });
});

describe('a new session', () => {
  test('is never started', () => {
    expect(runtime.newSessionArguments).toBeNull();
  });

  test('is never a fallback, whatever stderr says', () => {
    expect(runtime.isNewSessionFallback({ stderrText: 'Error: thread already has an active writer' })).toBe(false);
  });
});

describe('isolation', () => {
  function prepare() {
    return runtime.prepareIsolation({ connectionLink: CONNECTION_LINK, workingDirectory });
  }

  test('loads only the config file, no setting sources and no other MCP configuration', async () => {
    const { isolationArguments, cleanup } = await prepare();
    expect(isolationArguments).toEqual(['--strict-mcp-config', expect.stringMatching(/^--mcp-config=.+mcp\.json$/), '--setting-sources=']);
    await cleanup();
  });

  test('writes a 0600 file holding only the zapbip server', async () => {
    const { isolationArguments, cleanup } = await prepare();
    const file = (isolationArguments[1] as string).slice(MCP_CONFIG_PREFIX.length);
    expect((await stat(file)).mode & MODE_MASK).toBe(OWNER_ONLY_MODE);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ mcpServers: { zapbip: { type: 'http', url: CONNECTION_LINK } } });
    await cleanup();
  });

  test('cleanup removes the file', async () => {
    const { isolationArguments, cleanup } = await prepare();
    const file = (isolationArguments[1] as string).slice(MCP_CONFIG_PREFIX.length);
    await cleanup();
    await expect(access(file)).rejects.toThrow();
  });
});

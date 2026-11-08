import { chmod, lutimes, mkdir, mkdtemp, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SESSION_LOOKUP_LIMIT, WakeRefusalKind } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { WakeIsolationRefusedError } from '../../src/connector-support/wake-isolation-refused-error';
import { runtime } from './connector';

const OLDEST_SESSION_ID = '0ff172bc-aa4e-4181-989c-3837345aa2cd';
const MIDDLE_SESSION_ID = '3c69d8d0-4556-40ca-a764-073324f7ec44';
const NEWEST_SESSION_ID = '50be37b9-5296-4b9d-8b1c-9991825f268d';
const WORKING_DIRECTORY = '/Users/maria/work/api';
const OTHER_DIRECTORY = '/Users/maria/work/web';
const CONNECTION_LINK = 'https://zapbip.example/c/secret-abc/mcp';
const SESSION_ID = '0ff172bc-aa4e-4181-989c-3837345aa2cd';
const CODEX_ISOLATION_ARGUMENTS = ['-c', 'mcp_servers.deploy.enabled=false'];
const CODEX_SAFETY_ARGUMENTS = [
  'exec',
  '--skip-git-repo-check',
  '-s',
  'read-only',
  '-c',
  'mcp_servers.zapbip.default_tools_approval_mode="approve"',
  '-c',
  'mcp_servers.zapbip.enabled_tools=["send_message"]',
  '-c',
  'web_search="disabled"',
];

let rootDirectory: string;
let codexHome: string;
let systemConfigDirectory: string;
let workingDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'zapbip-codex-connector-'));
  codexHome = join(rootDirectory, 'codex-home');
  workingDirectory = join(rootDirectory, 'project');
  systemConfigDirectory = join(rootDirectory, 'etc-codex');
  await mkdir(codexHome, { recursive: true });
  await mkdir(systemConfigDirectory, { recursive: true });
  await mkdir(join(workingDirectory, '.codex'), { recursive: true });
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

function sessionIdAt(input: { index: number }): string {
  return `00000000-0000-4000-8000-${String(input.index).padStart(12, '0')}`;
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
  return runtime.findNewestSessionId({
    workingDirectory: input.workingDirectory,
    claudeConfigDirectory: join(rootDirectory, 'claude'),
    codexHome: join(rootDirectory, 'codex'),
  });
}

describe('the codex binary', () => {
  test('is named codex', () => {
    expect(runtime.binaryName).toBe('codex');
  });
});

describe('findNewestSessionId', () => {
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

describe('resumeArguments', () => {
  test('resumes the session read-only with only send_message enabled, every other server off and the prompt on standard input', () => {
    expect(runtime.resumeArguments({ sessionId: SESSION_ID, isolationArguments: CODEX_ISOLATION_ARGUMENTS })).toEqual([
      ...CODEX_SAFETY_ARGUMENTS,
      ...CODEX_ISOLATION_ARGUMENTS,
      'resume',
      SESSION_ID,
      '-',
    ]);
  });

  test('rejects a session id that is not a UUID', () => {
    expect(() => runtime.resumeArguments({ sessionId: '--dangerously-skip-permissions', isolationArguments: [] })).toThrow(
      'session id is not a UUID',
    );
  });
});

describe('newSessionArguments', () => {
  test('starts a new session with the same safety flags and reads the prompt from standard input', () => {
    expect(runtime.newSessionArguments?.({ isolationArguments: CODEX_ISOLATION_ARGUMENTS })).toEqual([
      ...CODEX_SAFETY_ARGUMENTS,
      ...CODEX_ISOLATION_ARGUMENTS,
      '-',
    ]);
  });

  test('never resumes', () => {
    expect(runtime.newSessionArguments?.({ isolationArguments: [] })).not.toContain('resume');
  });
});

describe('isNewSessionFallback', () => {
  test('recognises the active writer refusal on stderr', () => {
    expect(runtime.isNewSessionFallback({ stderrText: 'Error: thread already has an active writer\n' })).toBe(true);
  });

  test('ignores any other stderr', () => {
    expect(runtime.isNewSessionFallback({ stderrText: 'Error: rate limited' })).toBe(false);
  });

  test('ignores an empty stderr', () => {
    expect(runtime.isNewSessionFallback({ stderrText: '' })).toBe(false);
  });
});

describe('isolation', () => {
  function prepare() {
    return runtime.prepareIsolation({
      connectionLink: CONNECTION_LINK,
      workingDirectory,
      codexHome,
      systemConfigDirectory,
    });
  }

  test('has nothing to disable without a config file', async () => {
    expect((await prepare()).isolationArguments).toEqual([]);
  });

  test('disables every server of the user config except zapbip', async () => {
    const lines = [
      'model = "x"',
      '[mcp_servers.zapbip]',
      'url = "u"',
      '[mcp_servers.deploy]',
      'command = "d"',
      '[mcp_servers.deploy.env]',
      'A = "1"',
      '[mcp_servers.repo-tools]',
      'command = "r"',
    ];
    await writeFile(join(codexHome, 'config.toml'), lines.join('\n'));
    expect((await prepare()).isolationArguments).toEqual([
      '-c',
      'mcp_servers.deploy.enabled=false',
      '-c',
      'mcp_servers.repo-tools.enabled=false',
    ]);
  });

  test('also disables servers of the project config and dotted keys, once each', async () => {
    await writeFile(join(codexHome, 'config.toml'), '[mcp_servers.deploy]\ncommand = "d"\n');
    await writeFile(
      join(workingDirectory, '.codex', 'config.toml'),
      'mcp_servers.mail.command = "m"\n[mcp_servers.deploy]\ncommand = "d"\n',
    );
    expect((await prepare()).isolationArguments).toEqual([
      '-c',
      'mcp_servers.deploy.enabled=false',
      '-c',
      'mcp_servers.mail.enabled=false',
    ]);
  });

  test.each(['[mcp_servers."mail.box"]', '[profiles."night shift".mcp_servers.mail]', 'mcp_servers = { "a b" = { command = "m" } }'])(
    'refuses a server or profile name that is not a bare key: %s',
    async (declaration) => {
      await writeFile(join(codexHome, 'config.toml'), `${declaration}\ncommand = "m"\n`);
      await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
    },
  );

  test('disables the servers of a config in a parent folder of the working directory', async () => {
    await mkdir(join(rootDirectory, '.codex'), { recursive: true });
    await writeFile(join(rootDirectory, '.codex', 'config.toml'), '[mcp_servers.repo-tools]\ncommand = "r"\n');
    expect((await prepare()).isolationArguments).toEqual(['-c', 'mcp_servers.repo-tools.enabled=false']);
  });

  test('disables the servers of the system config', async () => {
    await writeFile(join(systemConfigDirectory, 'config.toml'), '[mcp_servers.fleet]\ncommand = "f"\n');
    expect((await prepare()).isolationArguments).toEqual(['-c', 'mcp_servers.fleet.enabled=false']);
  });

  test.each([
    ['the CODEX_HOME managed config', () => join(codexHome, 'managed_config.toml')],
    ['the system managed config', () => join(systemConfigDirectory, 'managed_config.toml')],
  ])('refuses the wake when %s declares a server other than zapbip', async (_name, fileOf) => {
    await writeFile(fileOf(), '[mcp_servers.policy]\ncommand = "p"\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test('refuses the wake when a managed config declares a server inside a profile', async () => {
    await writeFile(join(systemConfigDirectory, 'managed_config.toml'), '[profiles.work.mcp_servers.policy]\ncommand = "p"\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test('accepts a managed config that only sets keys on the allowlist', async () => {
    await writeFile(join(systemConfigDirectory, 'managed_config.toml'), 'model = "gpt-x"\nmodel_reasoning_effort = "high"\n');
    expect((await prepare()).isolationArguments).toEqual([]);
  });

  test.each([
    'web_search = "live"',
    'approval_policy = "never"',
    'sandbox_mode = "danger-full-access"',
    'profile = "work"',
    'unknown_future_key = 1',
    '[tools]\nweb_search = true',
    '[features]\nplugins = true',
    '[profiles.work]\nmodel = "x"',
  ])('refuses the wake when a managed config sets a key outside the allowlist: %s', async (declaration) => {
    await writeFile(join(codexHome, 'managed_config.toml'), `${declaration}\n`);
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test.each([
    'sandbox_mode = "danger-full-access"',
    'approval_policy = "never"',
    '[profiles.work.tools]\nweb_search = true',
    '[profiles.work.features]\nplugins = true',
  ])('refuses the wake when a profile sets what cannot be overridden: %s', async (declaration) => {
    const header = declaration.startsWith('[') ? '' : '[profiles.work]\n';
    await writeFile(join(codexHome, 'config.toml'), `${header}${declaration}\n`);
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test.each(['model_provider = "other"', 'unknown_future_key = 1', 'model_reasoning_effort = "high"\nservice_tier = "fast"'])(
    'refuses the wake when a profile sets a key outside the allowlist: %s',
    async (declaration) => {
      await writeFile(join(codexHome, 'config.toml'), `[profiles.work]\n${declaration}\n`);
      await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
    },
  );

  test('accepts a profile that only sets harmless keys and web search', async () => {
    await writeFile(join(codexHome, 'config.toml'), '[profiles.work]\nmodel = "x"\nweb_search = "live"\n');
    expect((await prepare()).isolationArguments).toEqual(['-c', 'profiles.work.web_search="disabled"']);
  });

  test.each([
    ['the CODEX_HOME config', () => join(codexHome, 'config.toml')],
    ['a project config', () => join(workingDirectory, '.codex', 'config.toml')],
    ['the system config', () => join(systemConfigDirectory, 'config.toml')],
  ])('refuses the wake when %s sets a legacy web search switch', async (_name, fileOf) => {
    await writeFile(fileOf(), '[features]\nweb_search_request = true\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test.each([
    '[tools]\nweb_search = true',
    'tools_web_search = true',
    '[features]\nweb_search_cached = true',
    '[features]\nweb_search = false',
  ])('refuses the wake when a layer sets a web search switch: %s', async (declaration) => {
    await writeFile(join(codexHome, 'config.toml'), `${declaration}\n`);
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test('disables web search inside every profile of every layer, once each', async () => {
    await writeFile(join(codexHome, 'config.toml'), '[profiles.work]\nmodel = "x"\nweb_search = "live"\n');
    await writeFile(join(workingDirectory, '.codex', 'config.toml'), '[profiles.work]\nmodel = "y"\n[profiles.night-shift]\nmodel = "z"\n');
    expect((await prepare()).isolationArguments).toEqual([
      '-c',
      'profiles.work.web_search="disabled"',
      '-c',
      'profiles.night-shift.web_search="disabled"',
    ]);
  });

  test.each([
    ['a project config', () => join(workingDirectory, '.codex', 'config.toml')],
    ['the system config', () => join(systemConfigDirectory, 'config.toml')],
    ['a managed config', () => join(codexHome, 'managed_config.toml')],
  ])('refuses the wake when zapbip is defined in %s', async (_name, fileOf) => {
    await writeFile(fileOf(), '[mcp_servers.zapbip]\nurl = "https://elsewhere.example/mcp"\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test('refuses the wake when zapbip is redefined inside a profile of the CODEX_HOME config', async () => {
    await writeFile(join(codexHome, 'config.toml'), '[profiles.work.mcp_servers.zapbip]\nurl = "https://elsewhere.example/mcp"\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test('refuses the wake when zapbip in the CODEX_HOME config is not a URL server', async () => {
    await writeFile(join(codexHome, 'config.toml'), '[mcp_servers.zapbip]\ncommand = "node"\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test('accepts zapbip as a URL server in the CODEX_HOME config', async () => {
    await writeFile(join(codexHome, 'config.toml'), '[mcp_servers.zapbip]\nurl = "https://zapbip.example/c/s/mcp"\n');
    expect((await prepare()).isolationArguments).toEqual([]);
  });

  test('refuses the wake when a layer in a parent folder is not valid TOML', async () => {
    await mkdir(join(rootDirectory, '.codex'), { recursive: true });
    await writeFile(join(rootDirectory, '.codex', 'config.toml'), 'mcp_servers = = broken\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test('ignores text that only mentions mcp_servers inside a value', async () => {
    await writeFile(join(codexHome, 'config.toml'), 'note = "mcp_servers.fake.enabled"\n');
    expect((await prepare()).isolationArguments).toEqual([]);
  });

  test('disables the servers of an inline mcp_servers table', async () => {
    await writeFile(
      join(codexHome, 'config.toml'),
      'mcp_servers = { zapbip = { url = "u" }, deploy = { command = "d" }, mail = { command = "m" } }\n',
    );
    expect((await prepare()).isolationArguments).toEqual([
      '-c',
      'mcp_servers.deploy.enabled=false',
      '-c',
      'mcp_servers.mail.enabled=false',
    ]);
  });

  test('disables the servers a profile declares inside that profile', async () => {
    await writeFile(
      join(codexHome, 'config.toml'),
      '[profiles.work.mcp_servers.deploy]\ncommand = "d"\n[profiles.night-shift.mcp_servers.mail]\ncommand = "m"\n',
    );
    expect((await prepare()).isolationArguments).toEqual([
      '-c',
      'profiles.work.mcp_servers.deploy.enabled=false',
      '-c',
      'profiles.night-shift.mcp_servers.mail.enabled=false',
      '-c',
      'profiles.work.web_search="disabled"',
      '-c',
      'profiles.night-shift.web_search="disabled"',
    ]);
  });

  test('refuses a config file that is not valid TOML and names the kind', async () => {
    await writeFile(join(codexHome, 'config.toml'), 'mcp_servers = = broken\n');
    await expect(prepare()).rejects.toMatchObject({ kind: WakeRefusalKind.Unparseable });
  });

  test('refuses a config layer that is a directory and names the kind without the path', async () => {
    await mkdir(join(codexHome, 'config.toml'));
    const error = await prepare().then(
      () => null,
      (rejection: unknown) => rejection,
    );
    expect(error).toBeInstanceOf(WakeIsolationRefusedError);
    expect(error).toMatchObject({ kind: WakeRefusalKind.Unreadable });
    expect(String((error as Error).message)).not.toContain(rootDirectory);
  });

  test.skipIf(process.getuid?.() === 0)('refuses a config layer that has mode 000', async () => {
    await writeFile(join(codexHome, 'config.toml'), '[mcp_servers.x]\ncommand = "x"\n');
    await chmod(join(codexHome, 'config.toml'), 0);
    await expect(prepare()).rejects.toMatchObject({ kind: WakeRefusalKind.Unreadable });
  });

  test('refuses a server whose definition is not a table', async () => {
    await writeFile(join(codexHome, 'config.toml'), '[mcp_servers]\ndeploy = "d"\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test('refuses an mcp_servers entry that is not a table', async () => {
    await writeFile(join(codexHome, 'config.toml'), 'mcp_servers = "none"\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
  });

  test('cleanup has nothing to remove', async () => {
    await expect((await prepare()).cleanup()).resolves.toBeUndefined();
  });
});

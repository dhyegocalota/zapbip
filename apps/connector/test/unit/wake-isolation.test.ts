import { access, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONNECTOR_KILL_GRACE_MS, CONNECTOR_WAKE_TIMEOUT_MS, ConnectorClient } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { removeStaleWakeDirectories, WAKE_ISOLATION_PREPARERS, WakeIsolationRefusedError } from '../../src/wake-isolation';

const CONNECTION_LINK = 'https://zapbip.example/c/secret-abc/mcp';
const OWNER_ONLY_MODE = 0o600;
const MODE_MASK = 0o777;
const MCP_CONFIG_PREFIX = '--mcp-config=';

let rootDirectory: string;
let codexHome: string;
let systemConfigDirectory: string;
let workingDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'zapbip-isolation-'));
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

describe('Claude Code isolation', () => {
  function prepare() {
    return WAKE_ISOLATION_PREPARERS[ConnectorClient.ClaudeCode]({ connectionLink: CONNECTION_LINK, workingDirectory });
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

describe('Codex isolation', () => {
  function prepare() {
    return WAKE_ISOLATION_PREPARERS[ConnectorClient.Codex]({
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

  test('disables the servers of the managed config', async () => {
    await writeFile(join(codexHome, 'managed_config.toml'), '[mcp_servers.policy]\ncommand = "p"\n');
    expect((await prepare()).isolationArguments).toEqual(['-c', 'mcp_servers.policy.enabled=false']);
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
    ]);
  });

  test('refuses a config file that is not valid TOML', async () => {
    await writeFile(join(codexHome, 'config.toml'), 'mcp_servers = = broken\n');
    await expect(prepare()).rejects.toBeInstanceOf(WakeIsolationRefusedError);
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

describe('removeStaleWakeDirectories', () => {
  const STALE_AGE_MS = CONNECTOR_WAKE_TIMEOUT_MS + CONNECTOR_KILL_GRACE_MS;
  let originalTemporaryDirectory: string | undefined;

  async function makeWakeDirectory(input: { name: string; ageMs: number }): Promise<string> {
    const directory = join(rootDirectory, input.name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'mcp.json'), '{}');
    const modifiedAtSeconds = (Date.now() - input.ageMs) / 1000;
    await utimes(directory, modifiedAtSeconds, modifiedAtSeconds);
    return directory;
  }

  beforeEach(() => {
    originalTemporaryDirectory = process.env.TMPDIR;
    process.env.TMPDIR = rootDirectory;
  });

  afterEach(() => {
    if (originalTemporaryDirectory === undefined) delete process.env.TMPDIR;
    if (originalTemporaryDirectory !== undefined) process.env.TMPDIR = originalTemporaryDirectory;
  });

  test('removes a leftover wake folder older than a wake can run', async () => {
    const leftover = await makeWakeDirectory({ name: 'zapbip-wake-old', ageMs: STALE_AGE_MS + 60_000 });
    await removeStaleWakeDirectories();
    await expect(access(leftover)).rejects.toThrow();
  });

  test('keeps a wake folder a running wake may still use', async () => {
    const running = await makeWakeDirectory({ name: 'zapbip-wake-running', ageMs: 1_000 });
    await removeStaleWakeDirectories();
    await expect(access(running)).resolves.toBeUndefined();
  });

  test('keeps folders that are not wake folders', async () => {
    const other = await makeWakeDirectory({ name: 'someone-elses', ageMs: STALE_AGE_MS + 60_000 });
    await removeStaleWakeDirectories();
    await expect(access(other)).resolves.toBeUndefined();
  });
});

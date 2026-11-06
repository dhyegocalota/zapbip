import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConnectorClient } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { WAKE_ISOLATION_PREPARERS, WakeIsolationRefusedError } from '../../src/wake-isolation';

const CONNECTION_LINK = 'https://zapbip.example/c/secret-abc/mcp';
const OWNER_ONLY_MODE = 0o600;
const MODE_MASK = 0o777;
const MCP_CONFIG_PREFIX = '--mcp-config=';

let rootDirectory: string;
let codexHome: string;
let workingDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'zapbip-isolation-'));
  codexHome = join(rootDirectory, 'codex-home');
  workingDirectory = join(rootDirectory, 'project');
  await mkdir(codexHome, { recursive: true });
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
    return WAKE_ISOLATION_PREPARERS[ConnectorClient.Codex]({ connectionLink: CONNECTION_LINK, workingDirectory, codexHome });
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

  test('quotes a name that is not a bare key', async () => {
    await writeFile(join(codexHome, 'config.toml'), '[mcp_servers."mail.box"]\ncommand = "m"\n');
    expect((await prepare()).isolationArguments).toEqual(['-c', 'mcp_servers."mail.box".enabled=false']);
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
      '[profiles.work.mcp_servers.deploy]\ncommand = "d"\n[profiles."night shift".mcp_servers.mail]\ncommand = "m"\n',
    );
    expect((await prepare()).isolationArguments).toEqual([
      '-c',
      'profiles.work.mcp_servers.deploy.enabled=false',
      '-c',
      'profiles."night shift".mcp_servers.mail.enabled=false',
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

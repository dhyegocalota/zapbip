import { createServer, type Server } from 'node:http';
import { access, mkdir, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { CONNECTOR_WAKE_TIMEOUT_MS, ConnectorClient, ConnectorSessionSource, ConnectorWakeOutcome, WAKE_ALLOWED_TOOL } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWake } from '../../src/wake-runner';
import { createFakeClients, runAt, type FakeClients } from '../support/fake-client-binary';
import { ownerTextMessage } from '../support/fake-event-server';

const CONNECTION_LINK = 'https://zapbip.example/c/secret-abc/mcp';
const DECOY_SERVER_NAME = 'deploy';
const OWNER_ONLY_MODE = 0o600;
const MCP_CONFIG_PREFIX = '--mcp-config=';
const SESSION_ID = '0b1f6c2e-5d7a-4c3b-9e8f-1a2b3c4d5e6f';
const FAILED_EXIT_CODE = 2;
const CHILD_OUTPUT_MARKER = 'SECRET-MARKER-42';
const SHELL_MARKER_FILE = 'pwned';
const FAKE_TIMER_NAMES = ['setTimeout', 'clearTimeout'] as const;
const HOLD_FOREVER_BEHAVIOR = { hang: true };

describe('runWake', () => {
  let fakeClients: FakeClients;

  function wake(input: { client: ConnectorClient; sessionId?: string | null; text?: string; connectionLink?: string }) {
    const { client, sessionId = SESSION_ID, text = 'Oi', connectionLink = CONNECTION_LINK } = input;
    return runWake({
      client,
      connectionLink,
      sessionSource: ConnectorSessionSource.Pinned,
      sessionId,
      message: ownerTextMessage({ messageId: 'msg_1', text }),
      workingDirectory: fakeClients.workingDirectory,
    });
  }

  beforeEach(async () => {
    fakeClients = await createFakeClients();
    fakeClients.apply({ behavior: {} });
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    await fakeClients.cleanup();
  });

  it('resumes the given Claude Code session and reports answered on exit 0', async () => {
    const result = await wake({ client: ConnectorClient.ClaudeCode });

    const runs = await fakeClients.readRuns();
    expect(result).toEqual({ outcome: ConnectorWakeOutcome.Answered, exitCode: 0 });
    expect(runs).toHaveLength(1);
    expect(runAt({ runs, index: 0 }).clientName).toBe('claude');
    expect(runAt({ runs, index: 0 }).argv).toEqual([
      '-p',
      '--resume',
      SESSION_ID,
      '--permission-mode',
      'dontAsk',
      '--tools=',
      '--strict-mcp-config',
      expect.stringMatching(/^--mcp-config=.+mcp\.json$/),
      '--setting-sources=',
      `--allowedTools=${WAKE_ALLOWED_TOOL}`,
    ]);
  });

  it('hands Claude Code a private config holding only the zapbip server and removes it after the child exits', async () => {
    await wake({ client: ConnectorClient.ClaudeCode });

    const runs = await fakeClients.readRuns();
    const run = runAt({ runs, index: 0 });
    const configFlag = run.argv.find((argument) => argument.startsWith(MCP_CONFIG_PREFIX)) as string;
    expect(run.mcpConfig?.mode).toBe(OWNER_ONLY_MODE);
    expect(JSON.parse(run.mcpConfig?.text as string)).toEqual({ mcpServers: { zapbip: { type: 'http', url: CONNECTION_LINK } } });
    await expect(access(configFlag.slice(MCP_CONFIG_PREFIX.length))).rejects.toThrow();
  });

  describe('another MCP server the owner configured', () => {
    let decoyServer: Server;
    let zapbipServer: Server;
    let decoyRequests: number;

    function listen(input: { handler: () => void }): Promise<Server> {
      const server = createServer((_request, response) => {
        input.handler();
        response.writeHead(200).end('{}');
      });
      return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
    }

    function linkOf(input: { server: Server }): string {
      return `http://127.0.0.1:${(input.server.address() as AddressInfo).port}/mcp`;
    }

    beforeEach(async () => {
      decoyRequests = 0;
      decoyServer = await listen({ handler: () => (decoyRequests += 1) });
      zapbipServer = await listen({ handler: () => undefined });
      vi.stubEnv('FAKE_CLIENT_USER_MCP_SERVERS', JSON.stringify({ [DECOY_SERVER_NAME]: { url: linkOf({ server: decoyServer }) } }));
      vi.stubEnv('FAKE_CLIENT_CALLS_MCP', '1');
    });

    afterEach(async () => {
      await Promise.all([decoyServer, zapbipServer].map((server) => new Promise((resolve) => server.close(resolve))));
    });

    it('is never reachable from a woken Claude Code child', async () => {
      const result = await wake({ client: ConnectorClient.ClaudeCode, connectionLink: linkOf({ server: zapbipServer }) });

      expect(result.outcome).toBe(ConnectorWakeOutcome.Answered);
      expect(decoyRequests).toBe(0);
    });
  });

  it('disables every other MCP server the owner configured for Codex and keeps zapbip', async () => {
    const codexConfig =
      '[mcp_servers.zapbip]\ncommand = "x"\n\n[mcp_servers.deploy]\ncommand = "y"\n\n[mcp_servers."mail.box".env]\nA = "1"\n';
    await mkdir(fakeClients.codexHome, { recursive: true });
    await writeFile(join(fakeClients.codexHome, 'config.toml'), codexConfig);
    await wake({ client: ConnectorClient.Codex });

    const runs = await fakeClients.readRuns();
    expect(runAt({ runs, index: 0 }).argv.slice(-7)).toEqual([
      '-c',
      'mcp_servers.deploy.enabled=false',
      '-c',
      'mcp_servers."mail.box".enabled=false',
      'resume',
      SESSION_ID,
      '-',
    ]);
  });

  it('resumes the given Codex session with the restricted flags', async () => {
    await wake({ client: ConnectorClient.Codex });

    const runs = await fakeClients.readRuns();
    const argv = runAt({ runs, index: 0 }).argv;
    expect(runAt({ runs, index: 0 }).clientName).toBe('codex');
    expect(argv.slice(0, 5)).toEqual(['exec', '--skip-git-repo-check', '-s', 'read-only', '-c']);
    expect(argv.slice(-3)).toEqual(['resume', SESSION_ID, '-']);
  });

  it('starts no process without a session', async () => {
    const result = await wake({ client: ConnectorClient.ClaudeCode, sessionId: null });

    expect(result).toEqual({ outcome: ConnectorWakeOutcome.NoSession, exitCode: null });
    expect(await fakeClients.readRuns()).toHaveLength(0);
  });

  it('runs the child in the working directory', async () => {
    await wake({ client: ConnectorClient.ClaudeCode });

    const runs = await fakeClients.readRuns();
    expect(runAt({ runs, index: 0 }).cwd).toBe(fakeClients.workingDirectory);
  });

  it('reports failed with the exit code on a non-zero exit', async () => {
    fakeClients.apply({ behavior: { exitCode: FAILED_EXIT_CODE } });

    expect(await wake({ client: ConnectorClient.ClaudeCode })).toEqual({
      outcome: ConnectorWakeOutcome.Failed,
      exitCode: FAILED_EXIT_CODE,
    });
  });

  it('reports failed with a null exit code when the binary is missing', async () => {
    vi.stubEnv('PATH', fakeClients.rootDirectory);

    expect(await wake({ client: ConnectorClient.ClaudeCode })).toEqual({ outcome: ConnectorWakeOutcome.Failed, exitCode: null });
  });

  it('terminates the child with SIGTERM after the timeout and reports failed', async () => {
    fakeClients.apply({ behavior: HOLD_FOREVER_BEHAVIOR });
    vi.useFakeTimers({ toFake: [...FAKE_TIMER_NAMES] });
    const waking = wake({ client: ConnectorClient.ClaudeCode });
    await vi.waitFor(async () => expect(await fakeClients.readRuns()).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(CONNECTOR_WAKE_TIMEOUT_MS);
    const result = await waking;

    const runs = await fakeClients.readRuns();
    expect(result.outcome).toBe(ConnectorWakeOutcome.Failed);
    expect(runAt({ runs, index: 0 }).signal).toBe('SIGTERM');
  });

  it('never prints the output of the child', async () => {
    fakeClients.apply({ behavior: { output: CHILD_OUTPUT_MARKER } });
    const written = vi.spyOn(process.stdout, 'write');
    const result = await wake({ client: ConnectorClient.ClaudeCode });

    expect(JSON.stringify(result)).not.toContain(CHILD_OUTPUT_MARKER);
    expect(written.mock.calls.flat().join('')).not.toContain(CHILD_OUTPUT_MARKER);
  });

  it('hands the owner prompt to the child on standard input and never in its arguments', async () => {
    await wake({ client: ConnectorClient.ClaudeCode, text: 'private words' });

    const runs = await fakeClients.readRuns();
    expect(runAt({ runs, index: 0 }).stdin).toContain('private words');
    expect(JSON.stringify(runAt({ runs, index: 0 }).argv)).not.toContain('private words');
  });

  it('removes the connection link from the environment of the child', async () => {
    vi.stubEnv('ZAPBIP_CONNECTION_URL', 'https://zapbip.example/c/secret/mcp');
    await wake({ client: ConnectorClient.ClaudeCode });

    const runs = await fakeClients.readRuns();
    expect(runAt({ runs, index: 0 }).hadConnectionUrl).toBe(false);
  });

  it('hands owner text to the child as input and runs no shell', async () => {
    const markerPath = join(fakeClients.rootDirectory, SHELL_MARKER_FILE);
    await wake({ client: ConnectorClient.ClaudeCode, text: `$(touch ${markerPath}); rm -rf ~ #` });

    const runs = await fakeClients.readRuns();
    expect(runAt({ runs, index: 0 }).stdin).toContain(`$(touch ${markerPath}); rm -rf ~ #`);
    await expect(access(markerPath)).rejects.toThrow();
  });

  describe('Codex active writer', () => {
    it('runs a new session in the same directory once and reports the fallback', async () => {
      fakeClients.apply({ behavior: { refuseResume: true } });
      const result = await wake({ client: ConnectorClient.Codex });

      const runs = await fakeClients.readRuns();
      expect(result.outcome).toBe(ConnectorWakeOutcome.FallbackNewThread);
      expect(runs).toHaveLength(2);
      expect(runAt({ runs, index: 0 }).argv).toContain('resume');
      expect(runAt({ runs, index: 1 }).argv).not.toContain('resume');
      expect(runAt({ runs, index: 1 }).cwd).toBe(fakeClients.workingDirectory);
      expect(runAt({ runs, index: 1 }).stdin).toBe(runAt({ runs, index: 0 }).stdin);
    });

    it('does not fall back a second time when the new session is refused too', async () => {
      fakeClients.apply({ behavior: { refuseAll: true } });
      const result = await wake({ client: ConnectorClient.Codex });

      expect(result.outcome).toBe(ConnectorWakeOutcome.Failed);
      expect(await fakeClients.readRuns()).toHaveLength(2);
    });

    it('does not fall back for Claude Code', async () => {
      fakeClients.apply({ behavior: { refuseAll: true } });
      const result = await wake({ client: ConnectorClient.ClaudeCode });

      expect(result.outcome).toBe(ConnectorWakeOutcome.Failed);
      expect(await fakeClients.readRuns()).toHaveLength(1);
    });

    it('does not fall back on a failure that is not the active writer refusal', async () => {
      fakeClients.apply({ behavior: { exitCode: FAILED_EXIT_CODE } });
      const result = await wake({ client: ConnectorClient.Codex });

      expect(result.outcome).toBe(ConnectorWakeOutcome.Failed);
      expect(await fakeClients.readRuns()).toHaveLength(1);
    });
  });
});

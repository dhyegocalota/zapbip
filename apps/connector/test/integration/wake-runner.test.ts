import { createServer, type Server } from 'node:http';
import { access } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { CONNECTOR_RUNTIMES, ConnectorClient, WakeIsolationRefusedError } from '@zapbip/agents/connector';
import {
  CONNECTOR_KILL_GRACE_MS,
  CONNECTOR_WAKE_TIMEOUT_MS,
  ConnectorSessionSource,
  ConnectorWakeOutcome,
  WakeRefusalKind,
} from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { launchOf } from '../../src/connector-config';
import { runWake } from '../../src/wake-runner';
import { ACTIVE_WRITER_TEXT, createFakeClients, runAt, type FakeClients } from '../support/fake-client-binary';
import { ownerTextMessage } from '../support/fake-event-server';
import { CONNECTOR_CLIENTS } from '../support/connector-clients';

const CONNECTION_LINK = 'https://zapbip.example/c/secret-abc/mcp';
const DECOY_SERVER_NAME = 'deploy';
const SESSION_ID = '0b1f6c2e-5d7a-4c3b-9e8f-1a2b3c4d5e6f';
const FAILED_EXIT_CODE = 2;
const CHILD_OUTPUT_MARKER = 'SECRET-MARKER-42';
const SHELL_MARKER_FILE = 'pwned';
const FAKE_TIMER_NAMES = ['setTimeout', 'clearTimeout'] as const;
const HOLD_FOREVER_BEHAVIOR = { hang: true };

describe('the registered runtimes', () => {
  it('are each covered by a decoy case, through the strict flag or the null reason', () => {
    const uncovered = Object.entries(CONNECTOR_RUNTIMES).filter(
      ([, runtime]) => runtime.strictMcpArgument === null && runtime.strictMcpNullReason === null,
    );
    expect(uncovered.map(([client]) => client)).toEqual([]);
  });
});

describe.each(CONNECTOR_CLIENTS)('runWake with the %s runtime', (client) => {
  const runtime = CONNECTOR_RUNTIMES[client];
  const fallsBackToNewSession = runtime.newSessionArguments !== null && runtime.isNewSessionFallback({ stderrText: ACTIVE_WRITER_TEXT });
  let fakeClients: FakeClients;

  function wake(input: { sessionId?: string | null; text?: string; connectionLink?: string } = {}) {
    const { sessionId = SESSION_ID, text = 'Oi', connectionLink = CONNECTION_LINK } = input;
    return runWake({
      client,
      launch: launchOf({ config: {}, client }),
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
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await fakeClients.cleanup();
  });

  it('resumes the given session with the arguments of its runtime and reports answered on exit 0', async () => {
    const result = await wake();

    const runs = await fakeClients.readRuns();
    expect(result).toEqual({ outcome: ConnectorWakeOutcome.Answered, exitCode: 0 });
    expect(runs).toHaveLength(1);
    expect(runAt({ runs, index: 0 }).clientName).toBe(runtime.binaryName);
    expect(runAt({ runs, index: 0 }).argv).toContain(SESSION_ID);
  });

  describe.runIf(runtime.strictMcpArgument !== null)('another MCP server the owner configured', () => {
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
      vi.stubEnv('FAKE_CLIENT_STRICT_ARGUMENT', runtime.strictMcpArgument as string);
    });

    afterEach(async () => {
      await Promise.all([decoyServer, zapbipServer].map((server) => new Promise((resolve) => server.close(resolve))));
    });

    it('is never reachable from a woken child', async () => {
      const result = await wake({ connectionLink: linkOf({ server: zapbipServer }) });

      expect(result.outcome).toBe(ConnectorWakeOutcome.Answered);
      expect(decoyRequests).toBe(0);
    });
  });

  describe.runIf(runtime.strictMcpNullReason !== null)('another MCP server the owner configured, which the runtime disables', () => {
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
      vi.stubEnv('FAKE_CLIENT_ZAPBIP_URL', linkOf({ server: zapbipServer }));
      await fakeClients.writeDecoy({ client, name: DECOY_SERVER_NAME, url: linkOf({ server: decoyServer }) });
    });

    afterEach(async () => {
      await Promise.all([decoyServer, zapbipServer].map((server) => new Promise((resolve) => server.close(resolve))));
    });

    it('is never reachable from a woken child', async () => {
      const result = await wake({ connectionLink: linkOf({ server: zapbipServer }) });

      expect(result.outcome).toBe(ConnectorWakeOutcome.Answered);
      expect(decoyRequests).toBe(0);
    });
  });

  it.each([WakeRefusalKind.Unparseable, WakeRefusalKind.Unreadable])(
    'refuses the wake when its runtime refuses isolation as %s and starts no process',
    async (kind) => {
      vi.spyOn(runtime, 'prepareIsolation').mockRejectedValue(new WakeIsolationRefusedError(kind));

      expect(await wake()).toEqual({ outcome: ConnectorWakeOutcome.RefusedIsolation, exitCode: null, refusalKind: kind });
      expect(await fakeClients.readRuns()).toHaveLength(0);
    },
  );

  it('starts no process without a session', async () => {
    const result = await wake({ sessionId: null });

    expect(result).toEqual({ outcome: ConnectorWakeOutcome.NoSession, exitCode: null });
    expect(await fakeClients.readRuns()).toHaveLength(0);
  });

  it('runs the child in the working directory', async () => {
    await wake();

    const runs = await fakeClients.readRuns();
    expect(runAt({ runs, index: 0 }).cwd).toBe(fakeClients.workingDirectory);
  });

  it('reports failed with the exit code on a non-zero exit', async () => {
    fakeClients.apply({ behavior: { exitCode: FAILED_EXIT_CODE } });

    expect(await wake()).toEqual({
      outcome: ConnectorWakeOutcome.Failed,
      exitCode: FAILED_EXIT_CODE,
    });
  });

  it('reports failed with a null exit code when the binary is missing', async () => {
    vi.stubEnv('PATH', fakeClients.rootDirectory);

    expect(await wake()).toEqual({ outcome: ConnectorWakeOutcome.Failed, exitCode: null });
  });

  it('terminates the child with SIGTERM after the timeout and reports failed', async () => {
    fakeClients.apply({ behavior: HOLD_FOREVER_BEHAVIOR });
    vi.useFakeTimers({ toFake: [...FAKE_TIMER_NAMES] });
    const waking = wake();
    await vi.waitFor(async () => expect(await fakeClients.readRuns()).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(CONNECTOR_WAKE_TIMEOUT_MS);
    const result = await waking;

    const runs = await fakeClients.readRuns();
    expect(result.outcome).toBe(ConnectorWakeOutcome.Failed);
    expect(runAt({ runs, index: 0 }).signal).toBe('SIGTERM');
  });

  it('kills with SIGKILL a child that ignores SIGTERM once the grace period passes and reports failed', async () => {
    fakeClients.apply({ behavior: { hang: true, ignoreSigterm: true } });
    vi.useFakeTimers({ toFake: [...FAKE_TIMER_NAMES] });
    const waking = wake();
    await vi.waitFor(async () => expect(await fakeClients.readRuns()).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(CONNECTOR_WAKE_TIMEOUT_MS);
    await vi.waitFor(async () => expect(await fakeClients.readRuns()).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(CONNECTOR_KILL_GRACE_MS);

    expect(await waking).toEqual({ outcome: ConnectorWakeOutcome.Failed, exitCode: null });
  });

  it('never prints the output of the child', async () => {
    fakeClients.apply({ behavior: { output: CHILD_OUTPUT_MARKER } });
    const written = vi.spyOn(process.stdout, 'write');
    const result = await wake();

    expect(JSON.stringify(result)).not.toContain(CHILD_OUTPUT_MARKER);
    expect(written.mock.calls.flat().join('')).not.toContain(CHILD_OUTPUT_MARKER);
  });

  it('hands the owner prompt to the child on standard input and never in its arguments', async () => {
    await wake({ text: 'private words' });

    const runs = await fakeClients.readRuns();
    expect(runAt({ runs, index: 0 }).stdin).toContain('private words');
    expect(JSON.stringify(runAt({ runs, index: 0 }).argv)).not.toContain('private words');
  });

  it('removes the connection link from the environment of the child', async () => {
    vi.stubEnv('ZAPBIP_CONNECTION_URL', 'https://zapbip.example/c/secret/mcp');
    await wake();

    const runs = await fakeClients.readRuns();
    expect(runAt({ runs, index: 0 }).hadConnectionUrl).toBe(false);
  });

  it('hands owner text to the child as input and runs no shell', async () => {
    const markerPath = join(fakeClients.rootDirectory, SHELL_MARKER_FILE);
    await wake({ text: `$(touch ${markerPath}); rm -rf ~ #` });

    const runs = await fakeClients.readRuns();
    expect(runAt({ runs, index: 0 }).stdin).toContain(`$(touch ${markerPath}); rm -rf ~ #`);
    await expect(access(markerPath)).rejects.toThrow();
  });

  describe('an active writer refusal', () => {
    it.runIf(fallsBackToNewSession)('runs a new session in the same directory once and reports the fallback', async () => {
      fakeClients.apply({ behavior: { refuseResume: true } });
      const result = await wake();

      const runs = await fakeClients.readRuns();
      expect(result.outcome).toBe(ConnectorWakeOutcome.FallbackNewThread);
      expect(runs).toHaveLength(2);
      expect(runAt({ runs, index: 0 }).argv).toContain(SESSION_ID);
      expect(runAt({ runs, index: 1 }).argv).not.toContain(SESSION_ID);
      expect(runAt({ runs, index: 1 }).cwd).toBe(fakeClients.workingDirectory);
      expect(runAt({ runs, index: 1 }).stdin).toBe(runAt({ runs, index: 0 }).stdin);
    });

    it('does not fall back a second time when the new session is refused too', async () => {
      fakeClients.apply({ behavior: { refuseAll: true } });
      const result = await wake();

      expect(result.outcome).toBe(ConnectorWakeOutcome.Failed);
      expect(await fakeClients.readRuns()).toHaveLength(fallsBackToNewSession ? 2 : 1);
    });

    it('does not fall back on a failure that is not the active writer refusal', async () => {
      fakeClients.apply({ behavior: { exitCode: FAILED_EXIT_CODE } });
      const result = await wake();

      expect(result.outcome).toBe(ConnectorWakeOutcome.Failed);
      expect(await fakeClients.readRuns()).toHaveLength(1);
    });
  });
});

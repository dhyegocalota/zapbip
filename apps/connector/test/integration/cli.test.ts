import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConnectorFrameType, ConnectorLogEvent } from '@zapbip/types';
import { build } from 'esbuild';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeClients, type FakeClientBehavior, type FakeClients } from '../support/fake-client-binary';
import {
  FAKE_SECRET,
  createSelfSignedCertificate,
  messagesFrame,
  ownerTextMessage,
  startFakeEventServer,
  type FakeEventServer,
  type TlsCertificate,
} from '../support/fake-event-server';

type CliProcess = {
  child: ChildProcessWithoutNullStreams;
  exited: Promise<number | null>;
  outputText: () => string;
  waitForEvent: (input: { event: ConnectorLogEvent }) => Promise<void>;
};

const CLI_ENTRY = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
const SESSION_ID = '0b1f6c2e-5d7a-4c3b-9e8f-1a2b3c4d5e6f';
const CONNECTION_URL_VARIABLE = 'ZAPBIP_CONNECTION_URL';
const DISABLE_TLS_VERIFICATION_VARIABLE = 'NODE_TLS_REJECT_UNAUTHORIZED';
const DISABLED_VERIFICATION = '0';
const EXIT_CODE_CLEAN = 0;
const EXIT_CODE_USAGE = 1;
const CONNECT_COMMAND = 'connect';

describe('zapbip connect', () => {
  let bundleDirectory: string;
  let bundleFile: string;
  let certificate: TlsCertificate;
  let removeCertificate: () => Promise<void>;
  let fakeClients: FakeClients;
  let server: FakeEventServer;
  let started: CliProcess[];

  function startCli(input: { arguments?: string[]; connectionUrl?: string | null; behavior?: FakeClientBehavior }): CliProcess {
    const { arguments: extraArguments = [], connectionUrl = server.connectionLink, behavior = {} } = input;
    const connectionEnvironment = connectionUrl === null ? {} : { [CONNECTION_URL_VARIABLE]: connectionUrl };
    const child = spawn(
      process.execPath,
      [
        bundleFile,
        CONNECT_COMMAND,
        '--client',
        'claude-code',
        '--cwd',
        fakeClients.workingDirectory,
        '--session',
        SESSION_ID,
        ...extraArguments,
      ],
      {
        env: {
          ...process.env,
          ...fakeClients.environment({ behavior }),
          ...connectionEnvironment,
          [DISABLE_TLS_VERIFICATION_VARIABLE]: DISABLED_VERIFICATION,
        },
        stdio: 'pipe',
      },
    );
    let collected = '';
    const waiters: { event: ConnectorLogEvent; resolve: () => void }[] = [];
    function collect(chunk: Buffer): void {
      collected += chunk.toString();
      waiters.filter((waiter) => collected.includes(`"event":"${waiter.event}"`)).forEach((waiter) => waiter.resolve());
    }
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const exited = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
    const cliProcess: CliProcess = {
      child,
      exited,
      outputText: () => collected,
      waitForEvent: ({ event }) =>
        collected.includes(`"event":"${event}"`) ? Promise.resolve() : new Promise((resolve) => waiters.push({ event, resolve })),
    };
    started.push(cliProcess);
    return cliProcess;
  }

  beforeAll(async () => {
    bundleDirectory = await mkdtemp(join(tmpdir(), 'zapbip-cli-bundle-'));
    bundleFile = join(bundleDirectory, 'cli.mjs');
    await build({
      entryPoints: [CLI_ENTRY],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node24',
      outfile: bundleFile,
      logLevel: 'silent',
    });
    const created = await createSelfSignedCertificate();
    certificate = created.certificate;
    removeCertificate = created.cleanup;
  });

  afterAll(async () => {
    await rm(bundleDirectory, { recursive: true, force: true });
    await removeCertificate();
  });

  beforeEach(async () => {
    started = [];
    fakeClients = await createFakeClients();
    server = await startFakeEventServer({ certificate });
  });

  afterEach(async () => {
    started.forEach((cliProcess) => cliProcess.child.kill('SIGKILL'));
    await Promise.all(started.map((cliProcess) => cliProcess.exited));
    await server.stop();
    await fakeClients.cleanup();
  });

  it('connects with the link from the environment and keeps the secret out of the process arguments and the output', async () => {
    const cliProcess = startCli({});
    await server.waitForConnections({ count: 1 });
    await cliProcess.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });

    const processArguments = execFileSync('ps', ['-o', 'args=', '-p', String(cliProcess.child.pid)], { encoding: 'utf8' });
    expect(processArguments).not.toContain(FAKE_SECRET);
    expect(cliProcess.outputText()).not.toContain(FAKE_SECRET);
  });

  it('asks for the link on the terminal when the environment variable is absent', async () => {
    const cliProcess = startCli({ connectionUrl: null });
    cliProcess.child.stdin.write(`${server.connectionLink}\n`);
    await server.waitForConnections({ count: 1 });

    expect(cliProcess.outputText()).not.toContain(FAKE_SECRET);
  });

  it('exits 1 with a usage error and no secret for an unknown client', async () => {
    const cliProcess = startCli({ arguments: ['--client', 'cursor'] });

    expect(await cliProcess.exited).toBe(EXIT_CODE_USAGE);
    expect(cliProcess.outputText()).not.toContain(FAKE_SECRET);
    expect(server.connectionCount()).toBe(0);
  });

  it.each(['SIGTERM', 'SIGINT'] as const)('closes the socket and exits 0 on %s', async (signal) => {
    const cliProcess = startCli({});
    await server.waitForLiveConnections({ count: 1 });
    cliProcess.child.kill(signal);

    expect(await cliProcess.exited).toBe(EXIT_CODE_CLEAN);
    await server.waitForLiveConnections({ count: 0 });
  });

  it('terminates a running wake on SIGTERM and wakes the message again after a restart', async () => {
    const first = startCli({ behavior: { hang: true } });
    await server.waitForConnections({ count: 1 });
    server.sendFrame({ frame: messagesFrame({ messages: [ownerTextMessage({ messageId: 'msg_1', text: 'Oi' })] }) });
    await first.waitForEvent({ event: ConnectorLogEvent.WakeStarted });
    await vi.waitFor(async () => expect(await fakeClients.readRuns()).toHaveLength(1));
    first.child.kill('SIGTERM');

    expect(await first.exited).toBe(EXIT_CODE_CLEAN);
    expect(server.framesOfType({ type: ConnectorFrameType.Done })).toHaveLength(0);
    await vi.waitFor(async () => expect((await fakeClients.readRuns()).map((run) => run.signal)).toEqual(['SIGTERM']));

    const second = startCli({});
    await server.waitForConnections({ count: 2 });
    server.sendFrame({ frame: messagesFrame({ messages: [ownerTextMessage({ messageId: 'msg_1', text: 'Oi' })] }) });
    await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
    expect(await fakeClients.readRuns()).toHaveLength(2);
    expect(second.child.exitCode).toBeNull();
  });

  it.each([['--help'], ['connect', '--help'], ['listen', '--help'], ['channel', '--help']])(
    'prints the usage of every command and exits 0 for %s',
    (...helpArguments) => {
      const output = execFileSync(process.execPath, [bundleFile, ...helpArguments], { encoding: 'utf8' });
      expect(output).toContain('connect');
      expect(output).toContain('listen');
      expect(output).toContain('channel');
    },
  );
});

void vi;

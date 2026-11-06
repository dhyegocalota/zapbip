import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { ConnectorFrameType, ConnectorLogEvent, UNAUTHORIZED_STATUS } from '@zapbip/types';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCliBundle, CONNECTION_URL_VARIABLE, DISABLE_TLS_VERIFICATION_ENVIRONMENT } from '../support/cli-bundle';
import {
  FAKE_SECRET,
  createSelfSignedCertificate,
  messagesFrame,
  ownerTextMessage,
  startFakeEventServer,
  type FakeEventServer,
  type TlsCertificate,
} from '../support/fake-event-server';

type ListenProcess = {
  child: ChildProcessWithoutNullStreams;
  exited: Promise<number | null>;
  standardOutput: () => string;
  standardError: () => string;
};

const LISTEN_COMMAND = 'listen';
const EXIT_CODE_CLEAN = 0;
const EXIT_CODE_FAILURE = 1;
const OWNER_TEXT = 'Please deploy the staging build';

function printedLines(input: { listenProcess: ListenProcess }): string[] {
  return input.listenProcess
    .standardOutput()
    .split('\n')
    .filter((line) => line !== '');
}

describe('zapbip listen', () => {
  let bundleFile: string;
  let cleanupBundle: () => Promise<void>;
  let certificate: TlsCertificate;
  let removeCertificate: () => Promise<void>;
  let server: FakeEventServer;
  let started: ListenProcess[];

  function startListen(input: { arguments?: string[]; connectionUrl?: string } = {}): ListenProcess {
    const { arguments: extraArguments = [], connectionUrl = server.connectionLink } = input;
    const child = spawn(process.execPath, [bundleFile, LISTEN_COMMAND, ...extraArguments], {
      env: { ...process.env, [CONNECTION_URL_VARIABLE]: connectionUrl, ...DISABLE_TLS_VERIFICATION_ENVIRONMENT },
      stdio: 'pipe',
    });
    let output = '';
    let errors = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (errors += chunk.toString()));
    const exited = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
    const listenProcess: ListenProcess = { child, exited, standardOutput: () => output, standardError: () => errors };
    started.push(listenProcess);
    return listenProcess;
  }

  function pushOwnerMessage(input: { messageId: string; text: string }): void {
    server.sendFrame({ frame: messagesFrame({ messages: [ownerTextMessage(input)] }) });
  }

  beforeAll(async () => {
    const bundle = await buildCliBundle();
    bundleFile = bundle.bundleFile;
    cleanupBundle = bundle.cleanup;
    const created = await createSelfSignedCertificate();
    certificate = created.certificate;
    removeCertificate = created.cleanup;
  });

  afterAll(async () => {
    await cleanupBundle();
    await removeCertificate();
  });

  beforeEach(async () => {
    started = [];
    server = await startFakeEventServer({ certificate });
  });

  afterEach(async () => {
    started.forEach((listenProcess) => listenProcess.child.kill('SIGKILL'));
    await Promise.all(started.map((listenProcess) => listenProcess.exited));
    await server.stop();
  });

  it('prints one JSON line per owner message and acknowledges it after printing', async () => {
    const listenProcess = startListen();
    await server.waitForLiveConnections({ count: 1 });
    pushOwnerMessage({ messageId: 'msg_1', text: OWNER_TEXT });
    await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });

    expect(printedLines({ listenProcess }).map((line) => JSON.parse(line))).toEqual([
      { messageId: 'msg_1', kind: 'text', sender: 'owner', verified: true, forwarded: false, text: OWNER_TEXT },
    ]);
    expect(server.framesOfType({ type: ConnectorFrameType.Done }).map((entry) => entry.frame.messageId)).toEqual(['msg_1']);
  });

  it('keeps the output to message lines and sends the logs to the error stream without any message text', async () => {
    const listenProcess = startListen();
    await server.waitForLiveConnections({ count: 1 });
    pushOwnerMessage({ messageId: 'msg_1', text: OWNER_TEXT });
    await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });

    expect(listenProcess.standardOutput()).not.toContain(ConnectorLogEvent.ConnectorConnected);
    expect(listenProcess.standardError()).toContain(ConnectorLogEvent.ConnectorConnected);
    expect(listenProcess.standardError()).not.toContain(OWNER_TEXT);
  });

  it('keeps the secret out of the process arguments and both output streams', async () => {
    const listenProcess = startListen();
    await server.waitForLiveConnections({ count: 1 });

    const processArguments = execFileSync('ps', ['-o', 'args=', '-p', String(listenProcess.child.pid)], { encoding: 'utf8' });
    expect(processArguments).not.toContain(FAKE_SECRET);
    expect(listenProcess.standardOutput() + listenProcess.standardError()).not.toContain(FAKE_SECRET);
  });

  it('stays alive across a dropped connection and prints a redelivered message once', async () => {
    const listenProcess = startListen();
    await server.waitForLiveConnections({ count: 1 });
    pushOwnerMessage({ messageId: 'msg_1', text: OWNER_TEXT });
    await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
    server.dropConnections();
    await server.waitForConnections({ count: 2 });
    await server.waitForLiveConnections({ count: 1 });
    pushOwnerMessage({ messageId: 'msg_1', text: OWNER_TEXT });
    await server.waitForFrames({ type: ConnectorFrameType.Done, count: 2 });

    expect(listenProcess.child.exitCode).toBeNull();
    expect(printedLines({ listenProcess })).toHaveLength(1);
  });

  it('exits 1 with no socket when the link is refused', async () => {
    await server.stop();
    server = await startFakeEventServer({ certificate, probeStatus: UNAUTHORIZED_STATUS });
    const listenProcess = startListen();

    expect(await listenProcess.exited).toBe(EXIT_CODE_FAILURE);
    expect(server.connectionCount()).toBe(0);
    expect(listenProcess.standardOutput()).toBe('');
  });

  it('exits 1 with a usage error for an argument', async () => {
    const listenProcess = startListen({ arguments: ['--client', 'codex'] });

    expect(await listenProcess.exited).toBe(EXIT_CODE_FAILURE);
    expect(server.connectionCount()).toBe(0);
  });

  it.each(['SIGTERM', 'SIGINT'] as const)('closes the socket and exits 0 on %s', async (signal) => {
    const listenProcess = startListen();
    await server.waitForLiveConnections({ count: 1 });
    listenProcess.child.kill(signal);

    expect(await listenProcess.exited).toBe(EXIT_CODE_CLEAN);
    await server.waitForLiveConnections({ count: 0 });
  });
});

void vi;

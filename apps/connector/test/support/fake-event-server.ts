import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer as createHttpServer, type RequestListener } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Duplex } from 'node:stream';
import type { AgentName, Message } from '@zapbip/core';
import {
  CONNECTOR_PONG_TEXT,
  CONNECTOR_PATH_SUFFIX,
  ConnectorFrameType,
  MessageDirection,
  MessageKind,
  WakeMode,
  HttpStatus,
} from '@zapbip/types';
import { WebSocketServer, type WebSocket } from 'ws';

export const FAKE_SECRET = 'fake-secret-0123456789abcdef';
export const FAKE_AGENT: AgentName = 'ana';
const FAKE_CONNECTION_PATH = `/c/${FAKE_SECRET}${CONNECTOR_PATH_SUFFIX}`;
const LOOPBACK_HOST = '127.0.0.1';
const CERTIFICATE_VALID_DAYS = '1';
const CERTIFICATE_KEY_BITS = 'rsa:2048';

export type TlsCertificate = { key: string; cert: string };

export type FakeEventServerOptions = {
  probeStatus?: number;
  upgradeStatus?: number | null;
  autoPong?: boolean;
  greet?: boolean;
  certificate?: TlsCertificate | null;
};

export type ReceivedFrame = { connectionIndex: number; frame: Record<string, unknown> };

export type FakeEventServer = {
  port: number;
  socketLink: string;
  connectionLink: string;
  setProbeStatus: (input: { status: number }) => void;
  probeCount: () => number;
  upgradeCount: () => number;
  connectionCount: () => number;
  liveConnectionCount: () => number;
  receivedFrames: () => ReceivedFrame[];
  framesOfType: (input: { type: ConnectorFrameType }) => ReceivedFrame[];
  waitForFrames: (input: { type: ConnectorFrameType; count: number }) => Promise<void>;
  waitForConnections: (input: { count: number }) => Promise<void>;
  waitForLiveConnections: (input: { count: number }) => Promise<void>;
  sendFrame: (input: { frame: object }) => void;
  sendText: (input: { text: string }) => void;
  sendBinary: (input: { payload: string }) => void;
  closeConnections: (input: { code: number }) => void;
  dropConnections: () => void;
  stop: () => Promise<void>;
};

type Waiter = { isSatisfied: () => boolean; resolve: () => void };

export function ownerTextMessage(input: { messageId: string; text: string }): Message {
  return {
    messageId: input.messageId,
    direction: MessageDirection.FromOwner,
    agent: FAKE_AGENT,
    at: 1,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    forwarded: false,
    handedTo: null,
    originMessageId: null,
    kind: MessageKind.Text,
    text: input.text,
  };
}

export function messagesFrame(input: { messages: Message[] }): object {
  return { type: ConnectorFrameType.Messages, messages: input.messages };
}

export function framePaddedToBytes(input: { byteLength: number }): string {
  const baseText = JSON.stringify({ type: ConnectorFrameType.Messages, messages: [], padding: '' });
  const padding = 'x'.repeat(input.byteLength - Buffer.byteLength(baseText));
  return JSON.stringify({ type: ConnectorFrameType.Messages, messages: [], padding });
}

export async function createSelfSignedCertificate(): Promise<{ certificate: TlsCertificate; cleanup: () => Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), 'zapbip-fake-tls-'));
  const keyFile = join(directory, 'key.pem');
  const certFile = join(directory, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      CERTIFICATE_KEY_BITS,
      '-nodes',
      '-keyout',
      keyFile,
      '-out',
      certFile,
      '-days',
      CERTIFICATE_VALID_DAYS,
      '-subj',
      `/CN=${LOOPBACK_HOST}`,
    ],
    {
      stdio: 'ignore',
    },
  );
  const certificate = { key: await readFile(keyFile, 'utf8'), cert: await readFile(certFile, 'utf8') };
  return { certificate, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

export async function startFakeEventServer(input: FakeEventServerOptions = {}): Promise<FakeEventServer> {
  const {
    probeStatus: initialProbeStatus = HttpStatus.UpgradeRequired,
    upgradeStatus = null,
    autoPong = true,
    greet = true,
    certificate = null,
  } = input;
  let probeStatus = initialProbeStatus;
  const sockets: { socket: WebSocket; connectionIndex: number }[] = [];
  const frames: ReceivedFrame[] = [];
  let waiters: Waiter[] = [];
  let probes = 0;
  let upgrades = 0;
  let connections = 0;

  function settleWaiters(): void {
    const pending = waiters.filter((waiter) => !waiter.isSatisfied());
    waiters.filter((waiter) => waiter.isSatisfied()).forEach((waiter) => waiter.resolve());
    waiters = pending;
  }

  function waitUntil(isSatisfied: () => boolean): Promise<void> {
    if (isSatisfied()) return Promise.resolve();
    return new Promise((resolve) => waiters.push({ isSatisfied, resolve }));
  }

  const handleProbe: RequestListener = (_request, response) => {
    probes += 1;
    response.writeHead(probeStatus).end();
    settleWaiters();
  };

  const socketServer = new WebSocketServer({ noServer: true });
  const httpServer = certificate === null ? createHttpServer(handleProbe) : createHttpsServer(certificate, handleProbe);

  function liveSockets(): WebSocket[] {
    return sockets.filter((entry) => entry.socket.readyState === entry.socket.OPEN).map((entry) => entry.socket);
  }

  function attach(socket: WebSocket): void {
    connections += 1;
    const connectionIndex = connections;
    sockets.push({ socket, connectionIndex });
    socket.on('message', (data, isBinary) => {
      const text = data.toString();
      const frame = JSON.parse(text) as Record<string, unknown>;
      frames.push({ connectionIndex, frame });
      const isPing = !isBinary && frame.type === ConnectorFrameType.Ping;
      if (isPing && autoPong) socket.send(CONNECTOR_PONG_TEXT);
      settleWaiters();
    });
    socket.on('close', settleWaiters);
    if (greet) socket.send(JSON.stringify({ type: ConnectorFrameType.Hello, agent: FAKE_AGENT, previousWakeMode: WakeMode.None }));
    settleWaiters();
  }

  httpServer.on('upgrade', (request, rawSocket: Duplex, head) => {
    upgrades += 1;
    settleWaiters();
    if (upgradeStatus !== null) {
      rawSocket.write(`HTTP/1.1 ${upgradeStatus} Rejected\r\nConnection: close\r\n\r\n`);
      rawSocket.destroy();
      return;
    }
    socketServer.handleUpgrade(request, rawSocket, head, attach);
  });

  await new Promise<void>((resolve) => httpServer.listen(0, LOOPBACK_HOST, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  const webSocketScheme = certificate === null ? 'ws' : 'wss';
  const httpScheme = certificate === null ? 'http' : 'https';

  return {
    port,
    socketLink: `${webSocketScheme}://${LOOPBACK_HOST}:${port}${FAKE_CONNECTION_PATH}`,
    connectionLink: `${httpScheme}://${LOOPBACK_HOST}:${port}/c/${FAKE_SECRET}/mcp`,
    setProbeStatus: ({ status }) => {
      probeStatus = status;
    },
    probeCount: () => probes,
    upgradeCount: () => upgrades,
    connectionCount: () => connections,
    liveConnectionCount: () => liveSockets().length,
    receivedFrames: () => [...frames],
    framesOfType: ({ type }) => frames.filter((entry) => entry.frame.type === type),
    waitForFrames: ({ type, count }) => waitUntil(() => frames.filter((entry) => entry.frame.type === type).length >= count),
    waitForConnections: ({ count }) => waitUntil(() => connections >= count),
    waitForLiveConnections: ({ count }) => waitUntil(() => liveSockets().length === count),
    sendFrame: ({ frame }) => liveSockets().forEach((socket) => socket.send(JSON.stringify(frame))),
    sendText: ({ text }) => liveSockets().forEach((socket) => socket.send(text)),
    sendBinary: ({ payload }) => liveSockets().forEach((socket) => socket.send(Buffer.from(payload), { binary: true })),
    closeConnections: ({ code }) => liveSockets().forEach((socket) => socket.close(code)),
    dropConnections: () => liveSockets().forEach((socket) => socket.terminate()),
    stop: async () => {
      sockets.forEach((entry) => entry.socket.terminate());
      socketServer.close();
      httpServer.closeAllConnections();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

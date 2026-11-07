import { createServer, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import type { AgentName, Message } from '@zapbip/core';
import {
  CONNECTOR_PATH_SUFFIX,
  CONNECTOR_PONG_TEXT,
  ConnectorFrameType,
  HttpStatus,
  MessageDirection,
  MessageKind,
  WakeMode,
} from '@zapbip/types';
import { WebSocketServer, type WebSocket } from 'ws';

export const FAKE_SECRET = 'zb_conn_fake0123456789abcdef0123456789abcdef012';
export const FAKE_AGENT: AgentName = 'ana';
const LOOPBACK_HOST = '127.0.0.1';
const FAKE_CONNECTION_PATH = `/c/${FAKE_SECRET}`;

export type FakeConnectorOptions = {
  probeStatus?: number;
  failedProbes?: number;
  failedUpgrades?: number;
  autoPong?: boolean;
  greet?: boolean;
};

export type ReceivedFrame = { connectionIndex: number; text: string; frame: Record<string, unknown> };

export type FakeConnector = {
  socketLink: string;
  connectionLink: string;
  probeCount: () => number;
  connectionCount: () => number;
  framesOfType: (input: { type: ConnectorFrameType }) => ReceivedFrame[];
  waitForFrames: (input: { type: ConnectorFrameType; count: number }) => Promise<void>;
  waitForConnections: (input: { count: number }) => Promise<void>;
  sendFrame: (input: { frame: object }) => void;
  sendText: (input: { text: string }) => void;
  closeConnections: (input: { code: number }) => void;
  dropConnections: () => void;
  setProbeStatus: (input: { status: number }) => void;
  stop: () => Promise<void>;
};

type Waiter = { isSatisfied: () => boolean; resolve: () => void };

export function ownerTextMessage(input: { messageId: string; text: string }): Message {
  return {
    messageId: input.messageId,
    direction: MessageDirection.FromOwner,
    agent: FAKE_AGENT,
    at: 1_700_000_000_000,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    forwarded: false,
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

export async function startFakeConnector(input: FakeConnectorOptions = {}): Promise<FakeConnector> {
  const {
    probeStatus: initialProbeStatus = HttpStatus.UpgradeRequired,
    failedProbes = 0,
    failedUpgrades = 0,
    autoPong = true,
    greet = true,
  } = input;
  let probeStatus = initialProbeStatus;
  let upgrades = 0;
  const sockets: WebSocket[] = [];
  const frames: ReceivedFrame[] = [];
  let waiters: Waiter[] = [];
  let probes = 0;
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

  const handleProbe: RequestListener = (request, response) => {
    probes += 1;
    settleWaiters();
    if (probes <= failedProbes) return request.socket.destroy();
    response.writeHead(probeStatus).end();
  };

  const socketServer = new WebSocketServer({ noServer: true });
  const httpServer = createServer(handleProbe);

  function liveSockets(): WebSocket[] {
    return sockets.filter((socket) => socket.readyState === socket.OPEN);
  }

  function attach(socket: WebSocket): void {
    connections += 1;
    const connectionIndex = connections;
    sockets.push(socket);
    socket.on('message', (data) => {
      const text = data.toString();
      const frame = JSON.parse(text) as Record<string, unknown>;
      frames.push({ connectionIndex, text, frame });
      if (frame.type === ConnectorFrameType.Ping && autoPong) socket.send(CONNECTOR_PONG_TEXT);
      settleWaiters();
    });
    socket.on('close', settleWaiters);
    if (greet) socket.send(JSON.stringify({ type: ConnectorFrameType.Hello, agent: FAKE_AGENT, previousWakeMode: WakeMode.None }));
    settleWaiters();
  }

  httpServer.on('upgrade', (request, rawSocket: Duplex, head) => {
    upgrades += 1;
    if (upgrades <= failedUpgrades) return rawSocket.destroy();
    socketServer.handleUpgrade(request, rawSocket, head, attach);
  });

  await new Promise<void>((resolve) => httpServer.listen(0, LOOPBACK_HOST, resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    socketLink: `ws://${LOOPBACK_HOST}:${port}${FAKE_CONNECTION_PATH}${CONNECTOR_PATH_SUFFIX}`,
    connectionLink: `http://${LOOPBACK_HOST}:${port}${FAKE_CONNECTION_PATH}/mcp`,
    probeCount: () => probes,
    connectionCount: () => connections,
    framesOfType: ({ type }) => frames.filter((entry) => entry.frame.type === type),
    waitForFrames: ({ type, count }) => waitUntil(() => frames.filter((entry) => entry.frame.type === type).length >= count),
    waitForConnections: ({ count }) => waitUntil(() => connections >= count),
    sendFrame: ({ frame }) => liveSockets().forEach((socket) => socket.send(JSON.stringify(frame))),
    sendText: ({ text }) => liveSockets().forEach((socket) => socket.send(text)),
    closeConnections: ({ code }) => liveSockets().forEach((socket) => socket.close(code)),
    dropConnections: () => liveSockets().forEach((socket) => socket.terminate()),
    setProbeStatus: ({ status }) => {
      probeStatus = status;
    },
    stop: async () => {
      sockets.forEach((socket) => socket.terminate());
      socketServer.close();
      httpServer.closeAllConnections();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

import type { DoneFrame, HelloFrame, MessagesFrame, ServerFrame } from '@zapbip/core';
import {
  CONNECTOR_FRAME_MAX_BYTES,
  CONNECTOR_PATH_SUFFIX,
  CONNECTOR_PING_TEXT,
  CONNECTOR_PONG_TEXT,
  ConnectorClient,
  ConnectorFrameType,
  ConnectorLogEvent,
  ConnectorSessionSource,
  ConnectorWakeOutcome,
  FrameRejectionReason,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  MCP_PATH_SUFFIX,
  MessageKind,
  RECONNECT_BASE_MS,
  RECONNECT_JITTER_RATIO,
  RECONNECT_MAX_MS,
  RECONNECT_STABLE_MS,
  REPLACED_CLOSE_CODE,
  SECRET_REVOKED_MESSAGE,
  UNAUTHORIZED_STATUS,
  UPGRADE_REQUIRED_STATUS,
} from '@zapbip/types';
import { logConnectorEvent, type ConnectorLogFields, type ConnectorLogger } from './log';
import { findNewestSessionId } from './session-lookup';
import { REAL_TIMERS, type CancelTimer, type ConnectorTimers } from './timers';
import { createWakeQueue, type WakeQueue } from './wake-queue';
import { runWake } from './wake-runner';

export type ServerFrameParse = { ok: true; frame: ServerFrame } | { ok: false; reason: FrameRejectionReason };

type SocketEnd = { code: number; wasStable: boolean };
type FrameBody = Record<string, unknown>;
type FrameParsers = Record<string, (input: { body: FrameBody }) => ServerFrame | null>;

const SECURE_PROTOCOL = 'https:';
const SOCKET_PROTOCOL = 'wss:';
const PROBE_PROTOCOLS: Record<string, string> = { 'ws:': 'http:', 'wss:': 'https:' };
const INVALID_LINK_MESSAGE = `the connection link must be an https link ending in ${MCP_PATH_SUFFIX}`;
const ABNORMAL_CLOSE_CODE = 1006;
const FAILURE_EXIT_CODE = 1;
const CLEAN_EXIT_CODE = 0;

function asRecord(input: { value: unknown }): FrameBody | null {
  if (typeof input.value !== 'object' || input.value === null || Array.isArray(input.value)) return null;
  return input.value as FrameBody;
}

export function deriveConnectorLinks(input: { connectionLink: string }): { probeLink: string; socketLink: string } {
  const parsed = URL.canParse(input.connectionLink) ? new URL(input.connectionLink) : null;
  const isValid = parsed !== null && parsed.protocol === SECURE_PROTOCOL && parsed.pathname.endsWith(MCP_PATH_SUFFIX);
  if (!isValid) throw new Error(INVALID_LINK_MESSAGE);
  parsed.pathname = `${parsed.pathname.slice(0, -MCP_PATH_SUFFIX.length)}${CONNECTOR_PATH_SUFFIX}`;
  const probeLink = parsed.toString();
  parsed.protocol = SOCKET_PROTOCOL;
  return { probeLink, socketLink: parsed.toString() };
}

export function reconnectDelayMs(input: { attempt: number; random: () => number }): number {
  if (input.attempt < 0) throw new Error('the reconnect attempt cannot be negative');
  const delayMs = RECONNECT_BASE_MS * 2 ** input.attempt;
  return Math.min(RECONNECT_MAX_MS, delayMs + Math.floor(input.random() * delayMs * RECONNECT_JITTER_RATIO));
}

export async function probeConnectorLink(input: { probeLink: string }): Promise<number> {
  const response = await fetch(input.probeLink, { redirect: 'error' });
  return response.status;
}

const MESSAGE_KINDS: string[] = Object.values(MessageKind);

function isTrustedMessage(input: { value: unknown }): boolean {
  const message = asRecord(input);
  if (message === null) return false;
  return typeof message.messageId === 'string' && typeof message.forwarded === 'boolean' && MESSAGE_KINDS.includes(String(message.kind));
}

const FRAME_PARSERS: FrameParsers = {
  [ConnectorFrameType.Hello]: ({ body }) => {
    if (typeof body.agent !== 'string' || typeof body.previousWakeMode !== 'string') return null;
    return body as unknown as HelloFrame;
  },
  [ConnectorFrameType.Messages]: ({ body }) => {
    const { messages } = body;
    const hasTrustedFields = Array.isArray(messages) && messages.every((message) => isTrustedMessage({ value: message }));
    if (!hasTrustedFields) return null;
    return body as unknown as MessagesFrame;
  },
};

export function parseServerFrame(input: { text: string; byteLength: number; isBinary: boolean }): ServerFrameParse {
  if (input.isBinary) return { ok: false, reason: FrameRejectionReason.BinaryFrame };
  if (input.byteLength > CONNECTOR_FRAME_MAX_BYTES) return { ok: false, reason: FrameRejectionReason.FrameTooLarge };
  const body = asRecord({ value: parseJson({ text: input.text }) });
  if (body === null) return { ok: false, reason: FrameRejectionReason.Malformed };
  const frameType = String(body.type);
  if (!Object.hasOwn(FRAME_PARSERS, frameType)) return { ok: false, reason: FrameRejectionReason.UnknownType };
  const parseFrame = FRAME_PARSERS[frameType] as FrameParsers[string];
  const frame = parseFrame({ body });
  if (frame === null) return { ok: false, reason: FrameRejectionReason.Malformed };
  return { ok: true, frame };
}

function parseJson(input: { text: string }): unknown {
  try {
    return JSON.parse(input.text);
  } catch {
    return null;
  }
}

function probeStatusOf(input: { socketLink: string }): Promise<number | null> {
  const probeLink = new URL(input.socketLink);
  probeLink.protocol = PROBE_PROTOCOLS[probeLink.protocol] as string;
  return probeConnectorLink({ probeLink: probeLink.toString() }).catch(() => null);
}

function waitOrAbort(input: { delayMs: number; signal: AbortSignal; timers: ConnectorTimers }): Promise<void> {
  return new Promise((resolve) => {
    const cancelTimer = input.timers.after({ run: resolve, delayMs: input.delayMs });
    input.signal.addEventListener(
      'abort',
      () => {
        cancelTimer();
        resolve();
      },
      { once: true },
    );
  });
}

export async function runSocketSession(input: {
  socketLink: string;
  signal: AbortSignal;
  log: ConnectorLogger;
  connectedFields: ConnectorLogFields;
  createQueue: (input: { sendDone: (input: { messageId: string }) => void }) => WakeQueue;
  timers?: ConnectorTimers;
  random?: () => number;
}): Promise<number> {
  const { socketLink, signal, log, connectedFields, createQueue, timers = REAL_TIMERS, random = Math.random } = input;
  const probeStatus = await probeStatusOf({ socketLink });
  if (probeStatus !== UPGRADE_REQUIRED_STATUS) {
    log({ event: ConnectorLogEvent.ConnectorClosed, fields: { status: probeStatus } });
    return FAILURE_EXIT_CODE;
  }

  let currentSocket: WebSocket | null = null;
  let agentName: string | null = null;

  function sendDone(doneInput: { messageId: string }): void {
    if (currentSocket === null || currentSocket.readyState !== WebSocket.OPEN) return;
    const frame: DoneFrame = { type: ConnectorFrameType.Done, messageId: doneInput.messageId };
    currentSocket.send(JSON.stringify(frame));
    log({ event: ConnectorLogEvent.DoneSent, fields: { messageId: doneInput.messageId } });
  }

  const wakeQueue = createQueue({ sendDone });

  const frameHandlers: Record<ConnectorFrameType.Hello | ConnectorFrameType.Messages, (input: { frame: ServerFrame }) => void> = {
    [ConnectorFrameType.Hello]: ({ frame }) => {
      const hello = frame as HelloFrame;
      agentName = hello.agent;
      log({
        event: ConnectorLogEvent.ConnectorConnected,
        fields: { agent: hello.agent, ...connectedFields, previousWakeMode: hello.previousWakeMode },
      });
    },
    [ConnectorFrameType.Messages]: ({ frame }) => {
      const { messages } = frame as MessagesFrame;
      log({ event: ConnectorLogEvent.MessagesReceived, fields: { count: messages.length } });
      messages.forEach((message) => wakeQueue.enqueue({ message }));
    },
  };

  function handleData(dataInput: { data: unknown }): void {
    const isBinary = typeof dataInput.data !== 'string';
    const text = isBinary ? '' : (dataInput.data as string);
    if (text === CONNECTOR_PONG_TEXT) return;
    const parsed = parseServerFrame({ text, byteLength: Buffer.byteLength(text), isBinary });
    if (!parsed.ok) return log({ event: ConnectorLogEvent.FrameRejected, fields: { reason: parsed.reason } });
    frameHandlers[parsed.frame.type as ConnectorFrameType.Hello | ConnectorFrameType.Messages]({ frame: parsed.frame });
  }

  function holdSocket(): Promise<SocketEnd> {
    return new Promise((resolve) => {
      const socket = new WebSocket(socketLink);
      currentSocket = socket;
      let wasStable = false;
      let cancelStability: CancelTimer | null = null;
      let hasEnded = false;
      let cancelHeartbeat: CancelTimer | null = null;
      let cancelTimeout: CancelTimer | null = null;

      function end(code: number): void {
        if (hasEnded) return;
        hasEnded = true;
        cancelHeartbeat?.();
        cancelTimeout?.();
        currentSocket = null;
        cancelStability?.();
        resolve({ code, wasStable });
      }

      function armHeartbeat(): void {
        if (cancelHeartbeat !== null) return;
        cancelStability = timers.after({
          delayMs: RECONNECT_STABLE_MS,
          run: () => {
            wasStable = true;
          },
        });
        cancelHeartbeat = timers.every({
          delayMs: HEARTBEAT_INTERVAL_MS,
          run: () => {
            socket.send(CONNECTOR_PING_TEXT);
            cancelTimeout = timers.after({
              delayMs: HEARTBEAT_TIMEOUT_MS,
              run: () => {
                log({ event: ConnectorLogEvent.ConnectorClosed, fields: { code: ABNORMAL_CLOSE_CODE } });
                end(ABNORMAL_CLOSE_CODE);
                socket.close();
              },
            });
          },
        });
      }

      socket.addEventListener('open', armHeartbeat);
      socket.addEventListener('message', (event) => {
        armHeartbeat();
        cancelTimeout?.();
        handleData({ data: event.data });
      });
      socket.addEventListener('close', (event) => {
        const isReplacement = event.code === REPLACED_CLOSE_CODE;
        if (isReplacement) log({ event: ConnectorLogEvent.ConnectorReplaced, fields: { agent: agentName } });
        if (!isReplacement) log({ event: ConnectorLogEvent.ConnectorClosed, fields: { code: event.code } });
        end(event.code);
      });
    });
  }

  signal.addEventListener(
    'abort',
    () => {
      currentSocket?.close();
    },
    { once: true },
  );

  let attempt = 0;
  while (!signal.aborted) {
    const end = await holdSocket();
    if (end.code === REPLACED_CLOSE_CODE) return FAILURE_EXIT_CODE;
    if (signal.aborted) break;
    const failedAttempts = end.wasStable ? 0 : attempt;
    const delayMs = reconnectDelayMs({ attempt: failedAttempts, random });
    log({ event: ConnectorLogEvent.ConnectorReconnecting, fields: { attempt: failedAttempts, delayMs } });
    await waitOrAbort({ delayMs, signal, timers });
    if (signal.aborted) break;
    const reconnectProbeStatus = await probeStatusOf({ socketLink });
    if (reconnectProbeStatus === UNAUTHORIZED_STATUS) {
      log({ event: ConnectorLogEvent.ConnectorClosed, fields: { status: UNAUTHORIZED_STATUS, message: SECRET_REVOKED_MESSAGE } });
      return FAILURE_EXIT_CODE;
    }
    attempt = failedAttempts + 1;
  }
  return CLEAN_EXIT_CODE;
}

export async function runConnection(input: {
  connectionLink: string;
  socketLink: string;
  client: ConnectorClient;
  workingDirectory: string;
  pinnedSessionId: string | null;
  signal: AbortSignal;
  timers?: ConnectorTimers;
  random?: () => number;
}): Promise<number> {
  const { connectionLink, socketLink, client, workingDirectory, pinnedSessionId, signal, timers, random } = input;
  const wakeAbortController = new AbortController();
  signal.addEventListener('abort', () => wakeAbortController.abort(), { once: true });

  async function resolveSession(): Promise<{ sessionSource: ConnectorSessionSource; sessionId: string | null }> {
    if (pinnedSessionId !== null) return { sessionSource: ConnectorSessionSource.Pinned, sessionId: pinnedSessionId };
    const sessionId = await findNewestSessionId({
      client,
      workingDirectory,
      claudeConfigDirectory: process.env.CLAUDE_CONFIG_DIR,
      codexHome: process.env.CODEX_HOME,
    });
    return { sessionSource: ConnectorSessionSource.Newest, sessionId };
  }

  function createQueue(queueInput: { sendDone: (input: { messageId: string }) => void }): WakeQueue {
    return createWakeQueue({
      sendDone: queueInput.sendDone,
      runWake: async ({ message }) => {
        const startedAt = Date.now();
        const { sessionSource, sessionId } = await resolveSession();
        logConnectorEvent({
          event: ConnectorLogEvent.WakeStarted,
          fields: { messageId: message.messageId, kind: message.kind, sessionKind: sessionSource },
        });
        const result = await runWake({
          client,
          connectionLink,
          sessionSource,
          sessionId,
          message,
          workingDirectory,
          signal: wakeAbortController.signal,
        });
        logConnectorEvent({
          event: ConnectorLogEvent.WakeFinished,
          fields: { messageId: message.messageId, outcome: result.outcome, exitCode: result.exitCode, elapsedMs: Date.now() - startedAt },
        });
        if (result.outcome === ConnectorWakeOutcome.NoSession) throw new Error('no session to wake');
      },
    });
  }

  return runSocketSession({ socketLink, signal, log: logConnectorEvent, connectedFields: { client }, createQueue, timers, random });
}

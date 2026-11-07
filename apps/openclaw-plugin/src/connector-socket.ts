import type { DoneFrame, HelloFrame, Message, MessagesFrame, ServerFrame } from '@zapbip/core';
import {
  CONNECTOR_FRAME_MAX_BYTES,
  CONNECTOR_PING_TEXT,
  CONNECTOR_PONG_TEXT,
  ConnectorFrameType,
  ConnectorLogEvent,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  HttpStatus,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  REPLACED_CLOSE_CODE,
  REVOKED_CLOSE_CODE,
} from '@zapbip/types';
import { WebSocket } from 'ws';
import { ABNORMAL_CLOSE_CODE, CLEAN_EXIT_CODE, FAILURE_EXIT_CODE, REPLACED_EXIT_CODE } from './constants';
import { parseServerFrame } from './frames';
import { createHandoffQueue } from './handoff-queue';
import { logConnectorEvent, type ConnectorLogger } from './log';

type SocketEnd = { code: number; wasOpened: boolean };
type Wait = (input: { delayMs: number; signal: AbortSignal }) => Promise<void>;

const PROBE_PROTOCOLS: Record<string, string> = { 'ws:': 'http:', 'wss:': 'https:' };

export function reconnectDelayMs(input: { attempt: number }): number {
  if (input.attempt < 0) throw new Error('the reconnect attempt cannot be negative');
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** input.attempt);
}

function waitOrAbort(input: { delayMs: number; signal: AbortSignal }): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, input.delayMs);
    input.signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function probeStatusOf(input: { socketLink: string; signal: AbortSignal }): Promise<number | null> {
  const probeLink = new URL(input.socketLink);
  probeLink.protocol = PROBE_PROTOCOLS[probeLink.protocol] as string;
  try {
    const response = await fetch(probeLink, { redirect: 'error', signal: input.signal });
    return response.status;
  } catch {
    return null;
  }
}

export async function runConnectorSocket({
  socketLink,
  signal,
  handOff,
  log = logConnectorEvent,
  wait = waitOrAbort,
  heartbeatIntervalMs = HEARTBEAT_INTERVAL_MS,
  heartbeatTimeoutMs = HEARTBEAT_TIMEOUT_MS,
}: {
  socketLink: string;
  signal: AbortSignal;
  handOff: (input: { message: Message }) => Promise<void>;
  log?: ConnectorLogger;
  wait?: Wait;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}): Promise<number> {
  let currentSocket: WebSocket | null = null;
  let agentName: string | null = null;

  async function resolveProbeStatus(): Promise<number | null> {
    let attempt = 0;
    while (!signal.aborted) {
      const status = await probeStatusOf({ socketLink, signal });
      if (status !== null) return status;
      const delayMs = reconnectDelayMs({ attempt });
      log({ event: ConnectorLogEvent.ConnectorReconnecting, fields: { attempt, delayMs } });
      await wait({ delayMs, signal });
      attempt += 1;
    }
    return null;
  }

  function sendDone(input: { messageId: string }): void {
    if (currentSocket === null || currentSocket.readyState !== WebSocket.OPEN) return;
    const frame: DoneFrame = { type: ConnectorFrameType.Done, messageId: input.messageId };
    currentSocket.send(JSON.stringify(frame));
    log({ event: ConnectorLogEvent.DoneSent, fields: { messageId: input.messageId } });
  }

  const handoffQueue = createHandoffQueue({ handOff, sendDone, log });

  const frameHandlers: Record<ConnectorFrameType.Hello | ConnectorFrameType.Messages, (input: { frame: ServerFrame }) => void> = {
    [ConnectorFrameType.Hello]: ({ frame }) => {
      const hello = frame as HelloFrame;
      agentName = hello.agent;
      log({ event: ConnectorLogEvent.ConnectorConnected, fields: { agent: hello.agent, previousWakeMode: hello.previousWakeMode } });
    },
    [ConnectorFrameType.Messages]: ({ frame }) => {
      const { messages } = frame as MessagesFrame;
      log({ event: ConnectorLogEvent.MessagesReceived, fields: { count: messages.length } });
      messages.forEach((message) => handoffQueue.enqueue({ message }));
    },
  };

  function handleData(input: { data: unknown }): void {
    const isBinary = typeof input.data !== 'string';
    const text = isBinary ? '' : (input.data as string);
    if (text === CONNECTOR_PONG_TEXT) return;
    const parsed = parseServerFrame({ text, byteLength: Buffer.byteLength(text), isBinary });
    if (!parsed.ok) return log({ event: ConnectorLogEvent.FrameRejected, fields: { reason: parsed.reason } });
    frameHandlers[parsed.frame.type as ConnectorFrameType.Hello | ConnectorFrameType.Messages]({ frame: parsed.frame });
  }

  function holdSocket(): Promise<SocketEnd> {
    return new Promise((resolve) => {
      const socket = new WebSocket(socketLink, { maxPayload: CONNECTOR_FRAME_MAX_BYTES });
      currentSocket = socket;
      let wasOpened = false;
      let hasEnded = false;
      let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

      function end(code: number): void {
        if (hasEnded) return;
        hasEnded = true;
        clearInterval(heartbeatTimer);
        clearTimeout(timeoutTimer);
        currentSocket = null;
        resolve({ code, wasOpened });
      }

      socket.addEventListener('open', () => {
        wasOpened = true;
        heartbeatTimer = setInterval(() => {
          socket.send(CONNECTOR_PING_TEXT);
          clearTimeout(timeoutTimer);
          timeoutTimer = setTimeout(() => {
            log({ event: ConnectorLogEvent.ConnectorClosed, fields: { code: ABNORMAL_CLOSE_CODE } });
            end(ABNORMAL_CLOSE_CODE);
            socket.close();
          }, heartbeatTimeoutMs);
        }, heartbeatIntervalMs);
      });
      socket.addEventListener('message', (event) => {
        clearTimeout(timeoutTimer);
        handleData({ data: event.data });
      });
      socket.addEventListener('error', () => undefined);
      socket.addEventListener('close', (event) => {
        const isReplacement = event.code === REPLACED_CLOSE_CODE;
        if (isReplacement) log({ event: ConnectorLogEvent.ConnectorReplaced, fields: { agent: agentName } });
        if (!isReplacement) log({ event: ConnectorLogEvent.ConnectorClosed, fields: { code: event.code } });
        end(event.code);
      });
    });
  }

  signal.addEventListener('abort', () => currentSocket?.close(), { once: true });

  async function refusalExitCode(): Promise<number | null> {
    const probeStatus = await resolveProbeStatus();
    if (signal.aborted) return CLEAN_EXIT_CODE;
    if (probeStatus === HttpStatus.UpgradeRequired) return null;
    log({ event: ConnectorLogEvent.ConnectorClosed, fields: { status: probeStatus } });
    return FAILURE_EXIT_CODE;
  }

  const firstRefusalExitCode = await refusalExitCode();
  if (firstRefusalExitCode !== null) return firstRefusalExitCode;

  let attempt = 0;
  while (!signal.aborted) {
    const end = await holdSocket();
    if (end.code === REPLACED_CLOSE_CODE) return REPLACED_EXIT_CODE;
    if (end.code === REVOKED_CLOSE_CODE) return FAILURE_EXIT_CODE;
    if (signal.aborted) break;
    const failedAttempts = end.wasOpened ? 0 : attempt;
    const delayMs = reconnectDelayMs({ attempt: failedAttempts });
    log({ event: ConnectorLogEvent.ConnectorReconnecting, fields: { attempt: failedAttempts, delayMs } });
    await wait({ delayMs, signal });
    attempt = failedAttempts + 1;
    if (end.wasOpened) continue;
    const retryRefusalExitCode = await refusalExitCode();
    if (retryRefusalExitCode !== null) return retryRefusalExitCode;
  }
  return CLEAN_EXIT_CODE;
}

import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CONNECTOR_FRAME_MAX_BYTES,
  ConnectorClient,
  ConnectorFrameType,
  ConnectorLogEvent,
  ConnectorWakeOutcome,
  FrameRejectionReason,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  RECONNECT_BASE_MS,
  REPLACED_CLOSE_CODE,
  UNAUTHORIZED_STATUS,
  WAKE_ALLOWED_TOOL,
  WakeMode,
} from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runConnection } from '../../src/connect';
import { createFakeClients, runAt, type FakeClients } from '../support/fake-client-binary';
import {
  FAKE_AGENT,
  FAKE_SECRET,
  framePaddedToBytes,
  messagesFrame,
  ownerTextMessage,
  startFakeEventServer,
  type FakeEventServer,
  type FakeEventServerOptions,
} from '../support/fake-event-server';

type LoggedEvent = { event: ConnectorLogEvent; fields: Record<string, string | number | boolean | null> };
type LogWaiter = { event: ConnectorLogEvent; count: number; resolve: () => void };

const logRecorder = vi.hoisted(() => ({
  events: [] as LoggedEvent[],
  waiters: [] as LogWaiter[],
}));

vi.mock('../../src/log', () => ({
  logConnectorEvent: (input: LoggedEvent) => {
    logRecorder.events.push(input);
    const satisfied = logRecorder.waiters.filter(
      (waiter) => logRecorder.events.filter((entry) => entry.event === waiter.event).length >= waiter.count,
    );
    satisfied.forEach((waiter) => waiter.resolve());
    logRecorder.waiters = logRecorder.waiters.filter((waiter) => !satisfied.includes(waiter));
  },
}));

const PINNED_SESSION_ID = '0b1f6c2e-5d7a-4c3b-9e8f-1a2b3c4d5e6f';
const NEWEST_SESSION_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const FAKE_TIMER_NAMES = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] as const;
const PREFLIGHT_SERVER_ERROR_STATUS = 500;
const EXIT_CODE_SIGNAL = 0;
const EXIT_CODE_REFUSED = 1;
const FAILED_WAKE_EXIT_CODE = 2;
const CHILD_OUTPUT_MARKER = 'SECRET-MARKER-42';
const SHELL_MARKER_FILE = 'pwned';
const SENTINEL_MESSAGE_ID = 'msg_sentinel';
const REPLACED_WAIT_FACTOR = 60;

function loggedEventsOf(input: { event: ConnectorLogEvent }): LoggedEvent[] {
  return logRecorder.events.filter((entry) => entry.event === input.event);
}

function loggedFieldsOf(input: { event: ConnectorLogEvent }): LoggedEvent['fields'] {
  const entry = loggedEventsOf(input)[0];
  if (entry === undefined) throw new Error(`${input.event} was not logged`);
  return entry.fields;
}

function waitForLog(input: { event: ConnectorLogEvent; count?: number }): Promise<void> {
  const { event, count = 1 } = input;
  if (loggedEventsOf({ event }).length >= count) return Promise.resolve();
  return new Promise((resolve) => logRecorder.waiters.push({ event, count, resolve }));
}

describe('runConnection', () => {
  let fakeClients: FakeClients;
  let server: FakeEventServer;
  let abortController: AbortController;
  let running: Promise<number>;

  async function startServer(input: FakeEventServerOptions = {}): Promise<void> {
    server = await startFakeEventServer(input);
  }

  async function restartServer(input: FakeEventServerOptions): Promise<void> {
    await server.stop();
    await startServer(input);
  }

  function startConnector(input: { pinnedSessionId?: string | null; client?: ConnectorClient; socketLink?: string } = {}): Promise<number> {
    const { pinnedSessionId = PINNED_SESSION_ID, client = ConnectorClient.ClaudeCode, socketLink = server.socketLink } = input;
    running = runConnection({
      socketLink,
      client,
      workingDirectory: fakeClients.workingDirectory,
      pinnedSessionId,
      signal: abortController.signal,
    });
    return running;
  }

  function useFakeTimers(): void {
    vi.useFakeTimers({ toFake: [...FAKE_TIMER_NAMES] });
  }

  async function reconnectAfterDrop(): Promise<void> {
    await waitForLog({ event: ConnectorLogEvent.ConnectorReconnecting });
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
    await server.waitForConnections({ count: 2 });
  }

  function sendMessages(input: { messageIds: string[] }): void {
    const messages = input.messageIds.map((messageId) => ownerTextMessage({ messageId, text: `text of ${messageId}` }));
    server.sendFrame({ frame: messagesFrame({ messages }) });
  }

  function doneMessageIds(): unknown[] {
    return server.framesOfType({ type: ConnectorFrameType.Done }).map((entry) => entry.frame.messageId);
  }

  function doneConnectionIndexes(): number[] {
    return server.framesOfType({ type: ConnectorFrameType.Done }).map((entry) => entry.connectionIndex);
  }

  async function proveAliveWithSentinel(): Promise<void> {
    const alreadyDone = doneMessageIds().length;
    sendMessages({ messageIds: [SENTINEL_MESSAGE_ID] });
    await server.waitForFrames({ type: ConnectorFrameType.Done, count: alreadyDone + 1 });
  }

  async function connectAndSend(input: { messageIds: string[] }): Promise<void> {
    startConnector();
    await server.waitForConnections({ count: 1 });
    sendMessages(input);
  }

  beforeEach(async () => {
    logRecorder.events = [];
    logRecorder.waiters = [];
    fakeClients = await createFakeClients();
    fakeClients.apply({ behavior: {} });
    abortController = new AbortController();
    await startServer();
  });

  afterEach(async () => {
    abortController.abort();
    await running;
    await server.stop();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    await fakeClients.cleanup();
  });

  describe('one owner message', () => {
    it('wakes the pinned session, answers done and logs the outcome', async () => {
      await connectAndSend({ messageIds: ['msg_1'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });

      const runs = await fakeClients.readRuns();
      expect(runs).toHaveLength(1);
      expect(runAt({ runs, index: 0 }).argv.slice(0, 4)).toEqual([
        '-p',
        '--resume',
        PINNED_SESSION_ID,
        `--allowedTools=${WAKE_ALLOWED_TOOL}`,
      ]);
      expect(runAt({ runs, index: 0 }).argv.at(-1)).toMatch(
        /^<channel source="zapbip" sender="owner" verified="true">text of msg_1<\/channel>/,
      );
      expect(doneMessageIds()).toEqual(['msg_1']);
      expect(loggedFieldsOf({ event: ConnectorLogEvent.WakeFinished })).toMatchObject({
        messageId: 'msg_1',
        outcome: ConnectorWakeOutcome.Answered,
        exitCode: 0,
      });
      expect(loggedFieldsOf({ event: ConnectorLogEvent.ConnectorConnected })).toMatchObject({
        agent: FAKE_AGENT,
        client: ConnectorClient.ClaudeCode,
        previousWakeMode: WakeMode.None,
      });
    });

    it('sends done after a failed wake', async () => {
      fakeClients.apply({ behavior: { exitCode: FAILED_WAKE_EXIT_CODE } });
      await connectAndSend({ messageIds: ['msg_1'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });

      expect(loggedFieldsOf({ event: ConnectorLogEvent.WakeFinished })).toMatchObject({
        outcome: ConnectorWakeOutcome.Failed,
        exitCode: FAILED_WAKE_EXIT_CODE,
      });
    });

    it('never logs the output of the child process', async () => {
      fakeClients.apply({ behavior: { output: CHILD_OUTPUT_MARKER } });
      await connectAndSend({ messageIds: ['msg_1'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });

      expect(JSON.stringify(logRecorder.events)).not.toContain(CHILD_OUTPUT_MARKER);
    });

    it('passes owner text to the child as one argument and never to a shell', async () => {
      const markerPath = join(fakeClients.rootDirectory, SHELL_MARKER_FILE);
      startConnector();
      await server.waitForConnections({ count: 1 });
      const message = ownerTextMessage({ messageId: 'msg_1', text: `$(touch ${markerPath})` });
      server.sendFrame({ frame: messagesFrame({ messages: [message] }) });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });

      const runs = await fakeClients.readRuns();
      expect(runAt({ runs, index: 0 }).argv.at(-1)).toContain(`$(touch ${markerPath})`);
      await expect(access(markerPath)).rejects.toThrow();
    });
  });

  describe('session resolution', () => {
    it('resumes the newest session of the working directory when none is pinned', async () => {
      await fakeClients.writeClaudeSession({ sessionId: NEWEST_SESSION_ID });
      startConnector({ pinnedSessionId: null });
      await server.waitForConnections({ count: 1 });
      sendMessages({ messageIds: ['msg_1'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });

      const runs = await fakeClients.readRuns();
      expect(runAt({ runs, index: 0 }).argv.slice(0, 3)).toEqual(['-p', '--resume', NEWEST_SESSION_ID]);
    });

    it('starts no process and sends no done when there is no session, then wakes once a session exists', async () => {
      await mkdir(fakeClients.claudeConfigDirectory, { recursive: true });
      startConnector({ pinnedSessionId: null });
      await server.waitForConnections({ count: 1 });
      sendMessages({ messageIds: ['msg_1'] });
      await waitForLog({ event: ConnectorLogEvent.WakeFinished });

      expect(loggedFieldsOf({ event: ConnectorLogEvent.WakeFinished })).toMatchObject({
        messageId: 'msg_1',
        outcome: ConnectorWakeOutcome.NoSession,
      });
      expect(await fakeClients.readRuns()).toHaveLength(0);

      await fakeClients.writeClaudeSession({ sessionId: NEWEST_SESSION_ID });
      sendMessages({ messageIds: ['msg_2'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
      expect(doneMessageIds()).toEqual(['msg_2']);
    });

    it('resumes on the next wake the session the Codex fallback created', async () => {
      const refusedSessionId = PINNED_SESSION_ID;
      await fakeClients.writeCodexRollout({ sessionId: refusedSessionId, modifiedAtSeconds: 1 });
      fakeClients.apply({ behavior: { refuseSession: refusedSessionId, rolloutSessionId: NEWEST_SESSION_ID } });
      startConnector({ pinnedSessionId: null, client: ConnectorClient.Codex });
      await server.waitForConnections({ count: 1 });
      sendMessages({ messageIds: ['msg_1'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
      sendMessages({ messageIds: ['msg_2'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 2 });

      const runs = await fakeClients.readRuns();
      expect(runs).toHaveLength(3);
      expect(runAt({ runs, index: 0 }).argv).toContain(refusedSessionId);
      expect(runAt({ runs, index: 1 }).argv).not.toContain('resume');
      expect(runAt({ runs, index: 2 }).argv).toContain(NEWEST_SESSION_ID);
    });
  });

  describe('ordering', () => {
    it('runs three simultaneous messages one after the other in arrival order', async () => {
      fakeClients.apply({ behavior: { runMs: 30 } });
      await connectAndSend({ messageIds: ['msg_1', 'msg_2', 'msg_3'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 3 });

      const runs = await fakeClients.readRuns();
      expect(runs.map((run) => run.argv.at(-1))).toEqual(
        ['msg_1', 'msg_2', 'msg_3'].map((messageId) => expect.stringContaining(`text of ${messageId}`)),
      );
      expect(runAt({ runs, index: 0 }).endedAt).toBeLessThanOrEqual(runAt({ runs, index: 1 }).startedAt);
      expect(runAt({ runs, index: 1 }).endedAt).toBeLessThanOrEqual(runAt({ runs, index: 2 }).startedAt);
      expect(doneMessageIds()).toEqual(['msg_1', 'msg_2', 'msg_3']);
    });
  });

  describe('frames', () => {
    it('logs only the reason for text that is not JSON and stays connected', async () => {
      startConnector();
      await server.waitForConnections({ count: 1 });
      server.sendText({ text: 'not json' });
      await waitForLog({ event: ConnectorLogEvent.FrameRejected });
      await proveAliveWithSentinel();

      expect(loggedFieldsOf({ event: ConnectorLogEvent.FrameRejected })).toEqual({ reason: FrameRejectionReason.Malformed });
      expect(server.connectionCount()).toBe(1);
    });

    it('rejects an unknown frame type without a wake', async () => {
      startConnector();
      await server.waitForConnections({ count: 1 });
      server.sendFrame({ frame: { type: 'surprise' } });
      await waitForLog({ event: ConnectorLogEvent.FrameRejected });
      await proveAliveWithSentinel();

      expect(loggedFieldsOf({ event: ConnectorLogEvent.FrameRejected })).toEqual({ reason: FrameRejectionReason.UnknownType });
      expect(await fakeClients.readRuns()).toHaveLength(1);
    });

    it('does nothing for an empty messages list', async () => {
      startConnector();
      await server.waitForConnections({ count: 1 });
      sendMessages({ messageIds: [] });
      await proveAliveWithSentinel();

      expect(await fakeClients.readRuns()).toHaveLength(1);
      expect(doneMessageIds()).toEqual([SENTINEL_MESSAGE_ID]);
      expect(loggedEventsOf({ event: ConnectorLogEvent.FrameRejected })).toHaveLength(0);
    });

    it('rejects a message without a message id and wakes nothing', async () => {
      startConnector();
      await server.waitForConnections({ count: 1 });
      const { messageId, ...withoutId } = ownerTextMessage({ messageId: 'msg_1', text: 'Oi' });
      expect(messageId).toBe('msg_1');
      server.sendFrame({ frame: { type: ConnectorFrameType.Messages, messages: [withoutId] } });
      await waitForLog({ event: ConnectorLogEvent.FrameRejected });
      await proveAliveWithSentinel();

      expect(await fakeClients.readRuns()).toHaveLength(1);
    });

    it('rejects a binary frame that carries a valid payload', async () => {
      startConnector();
      await server.waitForConnections({ count: 1 });
      const message = ownerTextMessage({ messageId: 'msg_1', text: 'Oi' });
      server.sendBinary({ payload: JSON.stringify(messagesFrame({ messages: [message] })) });
      await waitForLog({ event: ConnectorLogEvent.FrameRejected });
      await proveAliveWithSentinel();

      expect(loggedFieldsOf({ event: ConnectorLogEvent.FrameRejected })).toEqual({ reason: FrameRejectionReason.BinaryFrame });
      expect(doneMessageIds()).toEqual([SENTINEL_MESSAGE_ID]);
    });

    it('rejects a text frame one byte over the limit', async () => {
      startConnector();
      await server.waitForConnections({ count: 1 });
      server.sendText({ text: framePaddedToBytes({ byteLength: CONNECTOR_FRAME_MAX_BYTES + 1 }) });
      await waitForLog({ event: ConnectorLogEvent.FrameRejected });

      expect(loggedFieldsOf({ event: ConnectorLogEvent.FrameRejected })).toEqual({ reason: FrameRejectionReason.FrameTooLarge });
      expect(await fakeClients.readRuns()).toHaveLength(0);
    });

    it('accepts a text frame of exactly the limit', async () => {
      startConnector();
      await server.waitForConnections({ count: 1 });
      server.sendText({ text: framePaddedToBytes({ byteLength: CONNECTOR_FRAME_MAX_BYTES }) });
      await proveAliveWithSentinel();

      expect(loggedEventsOf({ event: ConnectorLogEvent.FrameRejected })).toHaveLength(0);
    });
  });

  describe('pre-flight', () => {
    it('exits 1 on a 401 without opening a socket and without logging the link', async () => {
      await restartServer({ probeStatus: UNAUTHORIZED_STATUS });
      const exitCode = await startConnector();

      expect(exitCode).toBe(EXIT_CODE_REFUSED);
      expect(server.upgradeCount()).toBe(0);
      expect(loggedFieldsOf({ event: ConnectorLogEvent.ConnectorClosed })).toMatchObject({ status: UNAUTHORIZED_STATUS });
      expect(JSON.stringify(logRecorder.events)).not.toContain(FAKE_SECRET);
    });

    it('continues on a 426', async () => {
      startConnector();
      await waitForLog({ event: ConnectorLogEvent.ConnectorConnected });

      expect(server.probeCount()).toBe(1);
      expect(server.connectionCount()).toBe(1);
    });

    it('exits 1 on a 500 without opening a socket', async () => {
      await restartServer({ probeStatus: PREFLIGHT_SERVER_ERROR_STATUS });
      const exitCode = await startConnector();

      expect(exitCode).toBe(EXIT_CODE_REFUSED);
      expect(server.upgradeCount()).toBe(0);
      expect(JSON.stringify(logRecorder.events)).not.toContain(FAKE_SECRET);
    });

    it('exits 1 when the host refuses the connection', async () => {
      const refusedLink = server.socketLink;
      await server.stop();
      const exitCode = await startConnector({ socketLink: refusedLink });

      expect(exitCode).toBe(EXIT_CODE_REFUSED);
      expect(JSON.stringify(logRecorder.events)).not.toContain(FAKE_SECRET);
    });
  });

  describe('heartbeat', () => {
    it('pings every interval and stays connected while pongs arrive', async () => {
      useFakeTimers();
      startConnector();
      await server.waitForConnections({ count: 1 });
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
      await server.waitForFrames({ type: ConnectorFrameType.Ping, count: 1 });
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
      await server.waitForFrames({ type: ConnectorFrameType.Ping, count: 2 });

      expect(server.connectionCount()).toBe(1);
      expect(loggedEventsOf({ event: ConnectorLogEvent.ConnectorReconnecting })).toHaveLength(0);
      expect(loggedEventsOf({ event: ConnectorLogEvent.FrameRejected })).toHaveLength(0);
    });

    it('closes and reconnects when no pong arrives within the timeout', async () => {
      await restartServer({ autoPong: false });
      useFakeTimers();
      startConnector();
      await server.waitForConnections({ count: 1 });
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
      await server.waitForFrames({ type: ConnectorFrameType.Ping, count: 1 });
      await vi.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS);
      await waitForLog({ event: ConnectorLogEvent.ConnectorReconnecting });

      expect(loggedFieldsOf({ event: ConnectorLogEvent.ConnectorReconnecting })).toEqual({ attempt: 0, delayMs: RECONNECT_BASE_MS });
      await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
      await server.waitForConnections({ count: 2 });
    });
  });

  describe('reconnect', () => {
    it('logs the close, reconnects after the base delay and greets again when the socket drops while idle', async () => {
      useFakeTimers();
      startConnector();
      await waitForLog({ event: ConnectorLogEvent.ConnectorConnected });
      server.dropConnections();
      await reconnectAfterDrop();
      await waitForLog({ event: ConnectorLogEvent.ConnectorConnected, count: 2 });

      expect(loggedEventsOf({ event: ConnectorLogEvent.ConnectorClosed })).toHaveLength(1);
      expect(loggedFieldsOf({ event: ConnectorLogEvent.ConnectorReconnecting })).toEqual({ attempt: 0, delayMs: RECONNECT_BASE_MS });
    });

    it('does not wake a message again while its wake is still running and sends its done on the new socket', async () => {
      fakeClients.apply({ behavior: { holdUntilFile: fakeClients.holdFile } });
      useFakeTimers();
      await connectAndSend({ messageIds: ['msg_1'] });
      await waitForLog({ event: ConnectorLogEvent.WakeStarted });
      server.dropConnections();
      await reconnectAfterDrop();
      sendMessages({ messageIds: ['msg_1'] });
      await waitForLog({ event: ConnectorLogEvent.MessagesReceived, count: 2 });
      await fakeClients.release();
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });

      expect(await fakeClients.readRuns()).toHaveLength(1);
      expect(doneConnectionIndexes()).toEqual([2]);
      expect(doneMessageIds()).toEqual(['msg_1']);
    });

    it('wakes only the new message of a re-read and sends each done once', async () => {
      fakeClients.apply({ behavior: { holdUntilFile: fakeClients.holdFile } });
      useFakeTimers();
      await connectAndSend({ messageIds: ['msg_1'] });
      await waitForLog({ event: ConnectorLogEvent.WakeStarted });
      server.dropConnections();
      await reconnectAfterDrop();
      sendMessages({ messageIds: ['msg_1', 'msg_2'] });
      await fakeClients.release();
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 2 });

      expect(await fakeClients.readRuns()).toHaveLength(2);
      expect(doneMessageIds()).toEqual(['msg_1', 'msg_2']);
    });

    it('answers a re-sent message with done and no wake when its done was lost with the socket', async () => {
      fakeClients.apply({ behavior: { holdUntilFile: fakeClients.holdFile } });
      useFakeTimers();
      await connectAndSend({ messageIds: ['msg_1'] });
      await waitForLog({ event: ConnectorLogEvent.WakeStarted });
      server.dropConnections();
      await waitForLog({ event: ConnectorLogEvent.ConnectorReconnecting });
      await fakeClients.release();
      await waitForLog({ event: ConnectorLogEvent.WakeFinished });
      await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS);
      await server.waitForConnections({ count: 2 });
      sendMessages({ messageIds: ['msg_1'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });

      expect(await fakeClients.readRuns()).toHaveLength(1);
      expect(doneConnectionIndexes()).toEqual([2]);
    });

    it('wakes an unacknowledged message again after the process restarts', async () => {
      await connectAndSend({ messageIds: ['msg_1'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
      abortController.abort();
      expect(await running).toBe(EXIT_CODE_SIGNAL);

      abortController = new AbortController();
      await connectAndSend({ messageIds: ['msg_1'] });
      await server.waitForFrames({ type: ConnectorFrameType.Done, count: 2 });

      expect(await fakeClients.readRuns()).toHaveLength(2);
    });
  });

  describe('replacement and shutdown', () => {
    it('exits 1 without reconnecting after being replaced', async () => {
      useFakeTimers();
      startConnector();
      await waitForLog({ event: ConnectorLogEvent.ConnectorConnected });
      server.closeConnections({ code: REPLACED_CLOSE_CODE });
      const exitCode = await running;
      await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS * REPLACED_WAIT_FACTOR);

      expect(exitCode).toBe(EXIT_CODE_REFUSED);
      expect(loggedFieldsOf({ event: ConnectorLogEvent.ConnectorReplaced })).toEqual({ agent: FAKE_AGENT });
      expect(server.connectionCount()).toBe(1);
      expect(loggedEventsOf({ event: ConnectorLogEvent.ConnectorReconnecting })).toHaveLength(0);
    });

    it('closes the socket and exits 0 on the signal', async () => {
      startConnector();
      await server.waitForLiveConnections({ count: 1 });
      abortController.abort();

      expect(await running).toBe(EXIT_CODE_SIGNAL);
      await server.waitForLiveConnections({ count: 0 });
    });
  });
});

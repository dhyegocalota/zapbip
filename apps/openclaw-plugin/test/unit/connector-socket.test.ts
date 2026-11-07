import type { Message } from '@zapbip/core';
import {
  CONNECTOR_FRAME_MAX_BYTES,
  ConnectorFrameType,
  ConnectorLogEvent,
  FrameRejectionReason,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  REPLACED_CLOSE_CODE,
  REVOKED_CLOSE_CODE,
  SEEN_MESSAGE_LIMIT,
} from '@zapbip/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ABNORMAL_CLOSE_CODE, REPLACED_EXIT_CODE } from '../../src/constants';
import { reconnectDelayMs, runConnectorSocket } from '../../src/connector-socket';
import type { ConnectorLogFields } from '../../src/log';
import {
  FAKE_SECRET,
  framePaddedToBytes,
  messagesFrame,
  ownerTextMessage,
  startFakeConnector,
  type FakeConnector,
  type FakeConnectorOptions,
} from '../support/fake-connector';

const FAST_HEARTBEAT_INTERVAL_MS = 40;
const FAST_HEARTBEAT_TIMEOUT_MS = 25;
const PROMPT_RETURN_MS = 100;
const IDLE_HEARTBEAT_MS = 60_000;
const BATCH_SIZE = 100;
const OWNER_SECRET_TEXT = 'segredo-do-dono';

type LoggedEvent = { event: ConnectorLogEvent; fields: ConnectorLogFields };

const stoppers: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  await Promise.all(stoppers.splice(0).map((stop) => stop()));
});

async function startConnector(input: FakeConnectorOptions = {}): Promise<FakeConnector> {
  const connector = await startFakeConnector(input);
  stoppers.push(connector.stop);
  return connector;
}

function startPlugin(input: {
  connector: FakeConnector;
  handOff?: (input: { message: Message }) => Promise<void>;
  wait?: (input: { delayMs: number; signal: AbortSignal }) => Promise<void>;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}) {
  const controller = new AbortController();
  const events: LoggedEvent[] = [];
  const delays: number[] = [];
  const {
    connector,
    handOff = vi.fn(() => Promise.resolve()),
    heartbeatIntervalMs = IDLE_HEARTBEAT_MS,
    heartbeatTimeoutMs = IDLE_HEARTBEAT_MS,
  } = input;
  const { wait = recordingWait({ delays }) } = input;
  const result = runConnectorSocket({
    socketLink: connector.socketLink,
    signal: controller.signal,
    handOff,
    log: (event) => events.push(event),
    wait,
    heartbeatIntervalMs,
    heartbeatTimeoutMs,
  });
  stoppers.push(() => {
    controller.abort();
    return result.then(() => undefined);
  });
  return { result, controller, events, delays, handOff };
}

function recordingWait(input: { delays: number[] }) {
  return ({ delayMs }: { delayMs: number; signal: AbortSignal }) => {
    input.delays.push(delayMs);
    return Promise.resolve();
  };
}

function doneIds(input: { connector: FakeConnector }): unknown[] {
  return input.connector.framesOfType({ type: ConnectorFrameType.Done }).map((entry) => entry.frame.messageId);
}

function chunk(input: { messages: Message[] }): Message[][] {
  return Array.from({ length: Math.ceil(input.messages.length / BATCH_SIZE) }, (_unused, index) =>
    input.messages.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  );
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolveCallback) => {
    resolve = resolveCallback;
  });
  return { promise, resolve };
}

describe('probe', () => {
  it('opens one socket when the probe answers 426', async () => {
    const connector = await startConnector();
    startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    expect(connector.probeCount()).toBe(1);
  });

  it.each([401, 404, 500])('stops with exit 1 and no socket when the probe answers %i', async (probeStatus) => {
    const connector = await startConnector({ probeStatus });
    const plugin = startPlugin({ connector });
    await expect(plugin.result).resolves.toBe(1);
    expect(connector.probeCount()).toBe(1);
    expect(connector.connectionCount()).toBe(0);
    expect(plugin.events).toEqual([{ event: ConnectorLogEvent.ConnectorClosed, fields: { status: probeStatus } }]);
  });

  it('retries a failing probe after 1000 then 2000 ms and then opens the socket', async () => {
    const connector = await startConnector({ failedProbes: 2 });
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    expect(plugin.delays.slice(0, 2)).toEqual([1_000, 2_000]);
    expect(connector.probeCount()).toBe(3);
  });
});

describe('handoff and done', () => {
  it('hands messages off in order and sends done after each handoff resolves', async () => {
    const connector = await startConnector();
    const firstHandoff = deferred();
    const handedOff: string[] = [];
    const handOff = vi.fn(({ message }: { message: Message }) => {
      handedOff.push(message.messageId);
      return message.messageId === 'msg_1' ? firstHandoff.promise : Promise.resolve();
    });
    startPlugin({ connector, handOff });
    await connector.waitForConnections({ count: 1 });
    connector.sendFrame({
      frame: messagesFrame({
        messages: [ownerTextMessage({ messageId: 'msg_1', text: 'um' }), ownerTextMessage({ messageId: 'msg_2', text: 'dois' })],
      }),
    });
    await vi.waitFor(() => expect(handedOff).toEqual(['msg_1']));
    expect(doneIds({ connector })).toEqual([]);
    firstHandoff.resolve();
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: 2 });
    expect(handedOff).toEqual(['msg_1', 'msg_2']);
    expect(doneIds({ connector })).toEqual(['msg_1', 'msg_2']);
  });

  it('sends no done for a rejected handoff, logs no text, and still hands the next message off', async () => {
    const connector = await startConnector();
    const handedOff: string[] = [];
    const handOff = vi.fn(({ message }: { message: Message }) => {
      handedOff.push(message.messageId);
      return message.messageId === 'msg_1' ? Promise.reject(new Error('dispatch failed')) : Promise.resolve();
    });
    const plugin = startPlugin({ connector, handOff });
    await connector.waitForConnections({ count: 1 });
    connector.sendFrame({
      frame: messagesFrame({
        messages: [
          ownerTextMessage({ messageId: 'msg_1', text: OWNER_SECRET_TEXT }),
          ownerTextMessage({ messageId: 'msg_2', text: 'dois' }),
        ],
      }),
    });
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
    expect(handedOff).toEqual(['msg_1', 'msg_2']);
    expect(doneIds({ connector })).toEqual(['msg_2']);
    expect(JSON.stringify(plugin.events)).not.toContain(OWNER_SECRET_TEXT);
  });

  it('hands a rejected message off again after a reconnect', async () => {
    const connector = await startConnector();
    let attempts = 0;
    const handOff = vi.fn(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('dispatch failed')) : Promise.resolve();
    });
    startPlugin({ connector, handOff });
    await connector.waitForConnections({ count: 1 });
    const frame = messagesFrame({ messages: [ownerTextMessage({ messageId: 'msg_1', text: 'um' })] });
    connector.sendFrame({ frame });
    await vi.waitFor(() => expect(handOff).toHaveBeenCalledTimes(1));
    connector.dropConnections();
    await connector.waitForConnections({ count: 2 });
    connector.sendFrame({ frame });
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
    expect(handOff).toHaveBeenCalledTimes(2);
  });

  it('hands a duplicate that arrives while its handoff runs off only once', async () => {
    const connector = await startConnector();
    const pendingHandoff = deferred();
    const handOff = vi.fn(() => pendingHandoff.promise);
    const plugin = startPlugin({ connector, handOff });
    await connector.waitForConnections({ count: 1 });
    const frame = messagesFrame({ messages: [ownerTextMessage({ messageId: 'msg_1', text: 'um' })] });
    connector.sendFrame({ frame });
    await vi.waitFor(() => expect(handOff).toHaveBeenCalledTimes(1));
    connector.sendFrame({ frame });
    connector.sendText({ text: JSON.stringify({ type: 'zzz' }) });
    await vi.waitFor(() => expect(plugin.events.map((entry) => entry.event)).toContain(ConnectorLogEvent.FrameRejected));
    pendingHandoff.resolve();
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
    expect(handOff).toHaveBeenCalledTimes(1);
  });

  it('skips a duplicate that arrives after its done and acknowledges it again', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    const frame = messagesFrame({ messages: [ownerTextMessage({ messageId: 'msg_1', text: 'um' })] });
    connector.sendFrame({ frame });
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
    connector.sendFrame({ frame });
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: 2 });
    expect(plugin.handOff).toHaveBeenCalledTimes(1);
  });

  it('remembers only the newest 1024 message ids', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    const total = SEEN_MESSAGE_LIMIT + 1;
    const messages = Array.from({ length: total }, (_unused, index) => ownerTextMessage({ messageId: `msg_${index}`, text: 'oi' }));
    chunk({ messages }).forEach((batch) => connector.sendFrame({ frame: messagesFrame({ messages: batch }) }));
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: total });
    connector.sendFrame({ frame: messagesFrame({ messages: [messages[0] as Message, messages[total - 1] as Message] }) });
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: total + 2 });
    expect(plugin.handOff).toHaveBeenCalledTimes(total + 1);
  });

  it('acknowledges with a done frame that carries only the type and the message id', async () => {
    const connector = await startConnector();
    startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.sendFrame({ frame: messagesFrame({ messages: [ownerTextMessage({ messageId: 'msg_1', text: OWNER_SECRET_TEXT })] }) });
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
    expect(connector.framesOfType({ type: ConnectorFrameType.Done })[0]?.frame).toEqual({
      type: ConnectorFrameType.Done,
      messageId: 'msg_1',
    });
  });
});

describe('heartbeat', () => {
  it('sends a ping on every interval', async () => {
    const connector = await startConnector();
    startPlugin({ connector, heartbeatIntervalMs: FAST_HEARTBEAT_INTERVAL_MS, heartbeatTimeoutMs: FAST_HEARTBEAT_INTERVAL_MS });
    await connector.waitForFrames({ type: ConnectorFrameType.Ping, count: 3 });
    expect(connector.connectionCount()).toBe(1);
  });

  it('reconnects when nothing answers a ping within the timeout', async () => {
    const connector = await startConnector({ autoPong: false });
    startPlugin({ connector, heartbeatIntervalMs: FAST_HEARTBEAT_INTERVAL_MS, heartbeatTimeoutMs: FAST_HEARTBEAT_TIMEOUT_MS });
    await connector.waitForConnections({ count: 2 });
  });

  it('treats any frame as proof of life', async () => {
    const connector = await startConnector({ autoPong: false });
    startPlugin({ connector, heartbeatIntervalMs: FAST_HEARTBEAT_INTERVAL_MS, heartbeatTimeoutMs: FAST_HEARTBEAT_TIMEOUT_MS });
    await connector.waitForFrames({ type: ConnectorFrameType.Ping, count: 1 });
    connector.sendFrame({ frame: messagesFrame({ messages: [] }) });
    await connector.waitForFrames({ type: ConnectorFrameType.Ping, count: 2 });
    expect(connector.connectionCount()).toBe(1);
  });
});

describe('close and reconnect', () => {
  it('stops without retry when the connector replaces it with 4001', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.closeConnections({ code: REPLACED_CLOSE_CODE });
    await expect(plugin.result).resolves.toBe(REPLACED_EXIT_CODE);
    expect(connector.connectionCount()).toBe(1);
    expect(plugin.events.map((entry) => entry.event)).toContain(ConnectorLogEvent.ConnectorReplaced);
  });

  it('stops with exit 1 and no retry when the connection is revoked with 4003', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.closeConnections({ code: REVOKED_CLOSE_CODE });
    await expect(plugin.result).resolves.toBe(1);
    expect(connector.connectionCount()).toBe(1);
    expect(connector.probeCount()).toBe(1);
    expect(plugin.events).toContainEqual({ event: ConnectorLogEvent.ConnectorClosed, fields: { code: REVOKED_CLOSE_CODE } });
  });

  it('probes again after an attempt that never opened and connects when the probe answers 426', async () => {
    const connector = await startConnector({ failedUpgrades: 1 });
    startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    expect(connector.probeCount()).toBe(2);
  });

  it('stops with exit 1 when the probe after an attempt that never opened answers 401', async () => {
    const connector = await startConnector({ failedUpgrades: 1 });
    const plugin = startPlugin({
      connector,
      wait: () => {
        connector.setProbeStatus({ status: 401 });
        return Promise.resolve();
      },
    });
    await expect(plugin.result).resolves.toBe(1);
    expect(connector.probeCount()).toBe(2);
    expect(connector.connectionCount()).toBe(0);
    expect(plugin.events).toContainEqual({ event: ConnectorLogEvent.ConnectorClosed, fields: { status: 401 } });
  });

  it('does not probe again after an attempt that opened', async () => {
    const connector = await startConnector();
    startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.dropConnections();
    await connector.waitForConnections({ count: 2 });
    expect(connector.probeCount()).toBe(1);
  });

  it('waits the base delay and reads the unread messages again after an abnormal close', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.dropConnections();
    await connector.waitForConnections({ count: 2 });
    expect(plugin.delays).toEqual([RECONNECT_BASE_MS]);
    expect(plugin.events.map((entry) => entry.event)).toContain(ConnectorLogEvent.ConnectorReconnecting);
  });

  it('closes after a hello with no messages and reconnects without a handoff', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.dropConnections();
    await connector.waitForConnections({ count: 2 });
    expect(plugin.handOff).not.toHaveBeenCalled();
  });

  it('resets the attempts after a successful open', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.dropConnections();
    await connector.waitForConnections({ count: 2 });
    connector.dropConnections();
    await connector.waitForConnections({ count: 3 });
    expect(plugin.delays).toEqual([RECONNECT_BASE_MS, RECONNECT_BASE_MS]);
  });

  it('returns promptly when the signal aborts during the backoff wait', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({
      connector,
      wait: ({ signal }) => new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true })),
    });
    await connector.waitForConnections({ count: 1 });
    connector.dropConnections();
    await vi.waitFor(() => expect(plugin.events.map((entry) => entry.event)).toContain(ConnectorLogEvent.ConnectorReconnecting));
    const startedAt = Date.now();
    plugin.controller.abort();
    await expect(plugin.result).resolves.toBe(0);
    expect(Date.now() - startedAt).toBeLessThan(PROMPT_RETURN_MS);
    expect(connector.connectionCount()).toBe(1);
  });

  it('closes the socket and resolves 0 when the signal aborts while connected', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    plugin.controller.abort();
    await expect(plugin.result).resolves.toBe(0);
  });
});

describe('reconnectDelayMs', () => {
  it.each([
    [0, 1_000],
    [1, 2_000],
    [2, 4_000],
    [3, 8_000],
    [4, 16_000],
    [5, RECONNECT_MAX_MS],
    [6, RECONNECT_MAX_MS],
  ])('attempt %i waits %i ms', (attempt, expected) => {
    expect(reconnectDelayMs({ attempt })).toBe(expected);
  });
});

describe('frame rules', () => {
  it('drops an unknown frame type and logs only the reason', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.sendText({ text: JSON.stringify({ type: 'zzz', text: OWNER_SECRET_TEXT }) });
    await vi.waitFor(() =>
      expect(plugin.events).toContainEqual({
        event: ConnectorLogEvent.FrameRejected,
        fields: { reason: FrameRejectionReason.UnknownType },
      }),
    );
    expect(JSON.stringify(plugin.events)).not.toContain(OWNER_SECRET_TEXT);
  });

  it.each(['__proto__', 'constructor', 'toString'])(
    'drops the inherited property name %s as an unknown type and keeps the socket',
    async (type) => {
      const connector = await startConnector();
      const plugin = startPlugin({ connector });
      await connector.waitForConnections({ count: 1 });
      connector.sendText({ text: JSON.stringify({ type }) });
      await vi.waitFor(() =>
        expect(plugin.events).toContainEqual({
          event: ConnectorLogEvent.FrameRejected,
          fields: { reason: FrameRejectionReason.UnknownType },
        }),
      );
      expect(connector.connectionCount()).toBe(1);
    },
  );

  it('drops the socket and reconnects on a frame one byte over the limit', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.sendText({ text: framePaddedToBytes({ byteLength: CONNECTOR_FRAME_MAX_BYTES + 1 }) });
    await connector.waitForConnections({ count: 2 });
    expect(plugin.events).toContainEqual({ event: ConnectorLogEvent.ConnectorClosed, fields: { code: ABNORMAL_CLOSE_CODE } });
  });

  it('accepts a frame of exactly the limit', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.sendText({ text: framePaddedToBytes({ byteLength: CONNECTOR_FRAME_MAX_BYTES }) });
    connector.sendFrame({ frame: messagesFrame({ messages: [ownerTextMessage({ messageId: 'msg_1', text: 'um' })] }) });
    await connector.waitForFrames({ type: ConnectorFrameType.Done, count: 1 });
    expect(plugin.events.map((entry) => entry.event)).not.toContain(ConnectorLogEvent.FrameRejected);
  });

  it('drops a malformed hello and a non-object frame', async () => {
    const connector = await startConnector();
    const plugin = startPlugin({ connector });
    await connector.waitForConnections({ count: 1 });
    connector.sendText({ text: JSON.stringify({ type: ConnectorFrameType.Hello, previousWakeMode: 'none' }) });
    connector.sendText({ text: 'null' });
    await vi.waitFor(() =>
      expect(plugin.events.filter((entry) => entry.event === ConnectorLogEvent.FrameRejected)).toEqual([
        { event: ConnectorLogEvent.FrameRejected, fields: { reason: FrameRejectionReason.Malformed } },
        { event: ConnectorLogEvent.FrameRejected, fields: { reason: FrameRejectionReason.Malformed } },
      ]),
    );
  });
});

describe('secrets', () => {
  it('never logs the secret or the link, on a refused probe or a live run', async () => {
    const refused = await startConnector({ probeStatus: 401 });
    const refusedPlugin = startPlugin({ connector: refused });
    await refusedPlugin.result;
    const live = await startConnector();
    const livePlugin = startPlugin({ connector: live });
    await live.waitForConnections({ count: 1 });
    live.dropConnections();
    await live.waitForConnections({ count: 2 });
    const logged = JSON.stringify([...refusedPlugin.events, ...livePlugin.events]);
    expect(logged).not.toContain(FAKE_SECRET);
    expect(logged).not.toContain('zb_conn_');
    expect(logged).not.toContain(live.socketLink);
  });
});

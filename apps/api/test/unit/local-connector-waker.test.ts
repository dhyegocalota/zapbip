import type { AgentWaker, Message } from '@zapbip/core';
import {
  AgentWakeReason,
  CONNECTOR_FRAME_MAX_BYTES,
  CONNECTOR_INBOX_LIMIT,
  ConnectorFrameType,
  FrameRejectionReason,
  MessageDirection,
  MessageKind,
  REPLACED_CLOSE_CODE,
  WakeOutcome,
} from '@zapbip/types';
import { describe, expect, test, vi } from 'vitest';
import { createEnvironment } from '../../../../libs/core/src/inbox/testing/fixtures';
import {
  acceptConnectorSocket,
  connectorAgentOf,
  parseDoneFrame,
  planMessageFrames,
  remainingSocketCount,
} from '../../src/account-inbox/connector-sockets';
import { createLocalConnectorWaker } from '../../src/adapters/wake/local-connector-waker';

type FakeSocket = WebSocket & { sent: string[]; closedWith: number[] };
type AcceptedSocket = { socket: WebSocket; tags: string[] };
type FakeState = { context: DurableObjectState; accepted: AcceptedSocket[] };

function createFakeSocket(): FakeSocket {
  const socket = {
    sent: [] as string[],
    closedWith: [] as number[],
    send: (data: string) => void socket.sent.push(data),
    close: (code: number) => void socket.closedWith.push(code),
  };
  return socket as unknown as FakeSocket;
}

function createFakeStateWithAccepted(input: { socketsByAgent: Record<string, FakeSocket[]> }): FakeState {
  const accepted: AcceptedSocket[] = [];
  const context = {
    getWebSockets: (tag: string) =>
      Object.entries(input.socketsByAgent)
        .filter(([agent]) => agent === tag)
        .flatMap(([, sockets]) => sockets),
    getTags: (socket: WebSocket) =>
      Object.entries(input.socketsByAgent)
        .filter(([, sockets]) => sockets.includes(socket as FakeSocket))
        .map(([agent]) => agent),
    acceptWebSocket: (socket: WebSocket, tags: string[]) => void accepted.push({ socket, tags }),
  };
  return { context: context as unknown as DurableObjectState, accepted };
}

function createFakeState(input: { socketsByAgent: Record<string, FakeSocket[]> }): DurableObjectState {
  return createFakeStateWithAccepted(input).context;
}

const LARGE_TEXT_BYTES = 10_000;

function ownerMessage(input: { index: number; text?: string }): Message {
  return {
    messageId: `msg_${input.index}`,
    direction: MessageDirection.FromOwner,
    agent: 'ana',
    at: input.index,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    forwarded: false,
    kind: MessageKind.Text,
    text: input.text === undefined ? `message ${input.index}` : input.text,
  };
}

const RESTORED_OUTCOME = WakeOutcome.Woken;

async function createWakerFixture(input: {
  socketsByAgent: Record<string, FakeSocket[]>;
  unreadCount: number;
  text?: string;
  restoreAndNotify?: AgentWaker['notify'];
}) {
  const environment = await createEnvironment();
  await Promise.all(
    Array.from({ length: input.unreadCount }, (_, index) =>
      environment.repository.insertMessage({ message: ownerMessage({ index, text: input.text }) }),
    ),
  );
  const waker = createLocalConnectorWaker({
    context: createFakeState({ socketsByAgent: input.socketsByAgent }),
    repository: environment.repository,
    restoreAndNotify: input.restoreAndNotify === undefined ? async () => WakeOutcome.Unreached : input.restoreAndNotify,
  });
  return { waker, environment };
}

function notifyAna(input: { waker: ReturnType<typeof createLocalConnectorWaker> }): Promise<WakeOutcome> {
  return input.waker.notify({ agent: 'ana', reason: AgentWakeReason.MessageWaiting });
}

describe('local connector waker', () => {
  test('with no socket the waker is unreached and sends no frame', async () => {
    const { waker } = await createWakerFixture({ socketsByAgent: {}, unreadCount: 2 });
    expect(await notifyAna({ waker })).toBe(WakeOutcome.Unreached);
  });

  test('with one socket and two unread messages it sends one messages frame', async () => {
    const socket = createFakeSocket();
    const { waker } = await createWakerFixture({ socketsByAgent: { ana: [socket] }, unreadCount: 2 });
    expect(await notifyAna({ waker })).toBe(WakeOutcome.Woken);
    expect(socket.sent).toHaveLength(1);
    const frame = JSON.parse(socket.sent.join());
    expect(frame.type).toBe(ConnectorFrameType.Messages);
    expect(frame.messages).toHaveLength(2);
  });

  test('with one socket and nothing unread it is unreached and sends no frame', async () => {
    const socket = createFakeSocket();
    const { waker } = await createWakerFixture({ socketsByAgent: { ana: [socket] }, unreadCount: 0 });
    expect(await notifyAna({ waker })).toBe(WakeOutcome.Unreached);
    expect(socket.sent).toEqual([]);
  });

  test('with two sockets for the agent the frame goes to each', async () => {
    const sockets = [createFakeSocket(), createFakeSocket()];
    const { waker } = await createWakerFixture({ socketsByAgent: { ana: sockets }, unreadCount: 1 });
    expect(await notifyAna({ waker })).toBe(WakeOutcome.Woken);
    expect(sockets.map((socket) => socket.sent.length)).toEqual([1, 1]);
  });

  test('a socket of another agent receives nothing', async () => {
    const other = createFakeSocket();
    const { waker } = await createWakerFixture({ socketsByAgent: { bruno: [other] }, unreadCount: 1 });
    expect(await notifyAna({ waker })).toBe(WakeOutcome.Unreached);
    expect(other.sent).toEqual([]);
  });

  test('the frame carries at most the connector inbox limit', async () => {
    const socket = createFakeSocket();
    const { waker } = await createWakerFixture({ socketsByAgent: { ana: [socket] }, unreadCount: CONNECTOR_INBOX_LIMIT + 10 });
    await notifyAna({ waker });
    expect(JSON.parse(socket.sent.join()).messages).toHaveLength(CONNECTOR_INBOX_LIMIT);
  });
});

describe('local waker without a live socket', () => {
  test('hands the wake to the restore path and returns its outcome', async () => {
    const restoreAndNotify = vi.fn(async () => RESTORED_OUTCOME);
    const { waker } = await createWakerFixture({ socketsByAgent: {}, unreadCount: 1, restoreAndNotify });
    expect(await notifyAna({ waker })).toBe(RESTORED_OUTCOME);
    expect(restoreAndNotify).toHaveBeenCalledWith({ agent: 'ana', reason: AgentWakeReason.MessageWaiting });
  });

  test('does not touch the restore path while a socket is live', async () => {
    const restoreAndNotify = vi.fn(async () => RESTORED_OUTCOME);
    const { waker } = await createWakerFixture({ socketsByAgent: { ana: [createFakeSocket()] }, unreadCount: 1, restoreAndNotify });
    await notifyAna({ waker });
    expect(restoreAndNotify).not.toHaveBeenCalled();
  });

  test('pushes every message only while a socket is live', async () => {
    const withSocket = await createWakerFixture({ socketsByAgent: { ana: [createFakeSocket()] }, unreadCount: 0 });
    const withoutSocket = await createWakerFixture({ socketsByAgent: {}, unreadCount: 0 });
    expect(await withSocket.waker.pushesEveryMessage({ agent: 'ana' })).toBe(true);
    expect(await withoutSocket.waker.pushesEveryMessage({ agent: 'ana' })).toBe(false);
  });
});

describe('large backlogs', () => {
  const largeText = 'x'.repeat(LARGE_TEXT_BYTES);

  test('a backlog over the frame limit is split into frames that each fit', async () => {
    const socket = createFakeSocket();
    const { waker } = await createWakerFixture({ socketsByAgent: { ana: [socket] }, unreadCount: 20, text: largeText });
    expect(await notifyAna({ waker })).toBe(WakeOutcome.Woken);
    const frames = socket.sent.map((text) => JSON.parse(text));
    expect(socket.sent.length).toBeGreaterThan(1);
    socket.sent.forEach((text) => expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(CONNECTOR_FRAME_MAX_BYTES));
    expect(frames.flatMap((frame) => frame.messages.map((message: Message) => message.messageId))).toHaveLength(20);
  });

  test('a single message that cannot fit in any frame is never reported as woken', async () => {
    const socket = createFakeSocket();
    const { waker } = await createWakerFixture({
      socketsByAgent: { ana: [socket] },
      unreadCount: 1,
      text: 'x'.repeat(CONNECTOR_FRAME_MAX_BYTES),
    });
    expect(await notifyAna({ waker })).toBe(WakeOutcome.Unreached);
    expect(socket.sent).toEqual([]);
  });

  test('the plan keeps the order and puts an oversized message aside', () => {
    const messages = [
      ownerMessage({ index: 1 }),
      ownerMessage({ index: 2, text: 'x'.repeat(CONNECTOR_FRAME_MAX_BYTES) }),
      ownerMessage({ index: 3 }),
    ];
    const plan = planMessageFrames({ messages });
    expect(plan.oversized.map((message) => message.messageId)).toEqual(['msg_2']);
    expect(plan.frames.flat().map((message) => message.messageId)).toEqual(['msg_1', 'msg_3']);
  });
});

describe('connector sockets', () => {
  test('the agent of a socket is its tag', () => {
    const socket = createFakeSocket();
    const context = createFakeState({ socketsByAgent: { ana: [socket] } });
    expect(connectorAgentOf({ context, socket: socket })).toBe('ana');
  });

  test('a socket with no tag is refused', () => {
    const context = createFakeState({ socketsByAgent: {} });
    expect(() => connectorAgentOf({ context, socket: createFakeSocket() })).toThrow();
  });

  test('the remaining count leaves out the closing socket', () => {
    const closing = createFakeSocket();
    const context = createFakeState({ socketsByAgent: { ana: [closing, createFakeSocket()] } });
    expect(remainingSocketCount({ context, agent: 'ana', closing: closing })).toBe(1);
  });

  test('the remaining count leaves out sockets that are already closing', () => {
    const closing = createFakeSocket();
    const replaced = Object.assign(createFakeSocket(), { readyState: WebSocket.CLOSING });
    const context = createFakeState({ socketsByAgent: { ana: [closing, replaced] } });
    expect(remainingSocketCount({ context, agent: 'ana', closing })).toBe(0);
  });

  test('the remaining count is zero when the closing socket is the only one', () => {
    const closing = createFakeSocket();
    const context = createFakeState({ socketsByAgent: { ana: [closing] } });
    expect(remainingSocketCount({ context, agent: 'ana', closing: closing })).toBe(0);
  });

  test('accepting a socket closes the previous sockets of the agent with the replaced code', () => {
    const previous = createFakeSocket();
    const client = createFakeSocket();
    const server = createFakeSocket();
    vi.stubGlobal(
      'WebSocketPair',
      class {
        0 = client;
        1 = server;
      },
    );
    const { context, accepted } = createFakeStateWithAccepted({ socketsByAgent: { ana: [previous] } });
    const returned = acceptConnectorSocket({ context, agent: 'ana' });
    vi.unstubAllGlobals();
    expect(previous.closedWith).toEqual([REPLACED_CLOSE_CODE]);
    expect(accepted).toEqual([{ socket: server, tags: ['ana'] }]);
    expect(returned).toBe(client);
  });
});

describe('done frame validation', () => {
  const done = JSON.stringify({ type: ConnectorFrameType.Done, messageId: 'msg_1' });

  test('a done text frame is accepted', () => {
    expect(parseDoneFrame({ data: done })).toEqual({ ok: true, frame: { type: ConnectorFrameType.Done, messageId: 'msg_1' } });
  });

  test('a binary frame is rejected', () => {
    const data = new TextEncoder().encode(done).buffer as ArrayBuffer;
    expect(parseDoneFrame({ data })).toEqual({ ok: false, reason: FrameRejectionReason.BinaryFrame });
  });

  test('a text frame over the limit is rejected', () => {
    const data = 'x'.repeat(CONNECTOR_FRAME_MAX_BYTES + 1);
    expect(parseDoneFrame({ data })).toEqual({ ok: false, reason: FrameRejectionReason.FrameTooLarge });
  });

  test('a text frame at the limit reaches parsing', () => {
    const data = 'x'.repeat(CONNECTOR_FRAME_MAX_BYTES);
    expect(parseDoneFrame({ data })).toEqual({ ok: false, reason: FrameRejectionReason.Malformed });
  });

  test('a multibyte frame is measured in bytes', () => {
    const data = 'é'.repeat(CONNECTOR_FRAME_MAX_BYTES / 2 + 1);
    expect(parseDoneFrame({ data })).toEqual({ ok: false, reason: FrameRejectionReason.FrameTooLarge });
  });

  test('text that is not json is malformed', () => {
    expect(parseDoneFrame({ data: 'not json' })).toEqual({ ok: false, reason: FrameRejectionReason.Malformed });
  });

  test('a done frame without a message id is malformed', () => {
    const data = JSON.stringify({ type: ConnectorFrameType.Done });
    expect(parseDoneFrame({ data })).toEqual({ ok: false, reason: FrameRejectionReason.Malformed });
  });

  test('a json value that is not an object is malformed', () => {
    expect(parseDoneFrame({ data: 'null' })).toEqual({ ok: false, reason: FrameRejectionReason.Malformed });
  });

  test('an unknown type is rejected', () => {
    const data = JSON.stringify({ type: 'bogus', messageId: 'msg_1' });
    expect(parseDoneFrame({ data })).toEqual({ ok: false, reason: FrameRejectionReason.UnknownType });
  });

  test('a frame type other than done is rejected', () => {
    const data = JSON.stringify({ type: ConnectorFrameType.Messages, messages: [] });
    expect(parseDoneFrame({ data })).toEqual({ ok: false, reason: FrameRejectionReason.UnknownType });
  });
});

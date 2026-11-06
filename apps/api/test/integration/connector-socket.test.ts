import type { CoreDependencies, Message } from '@zapbip/core';
import {
  CONNECTOR_FRAME_MAX_BYTES,
  CONNECTOR_PING_TEXT,
  CONNECTOR_PONG_TEXT,
  ConnectorFrameType,
  REPLACED_CLOSE_CODE,
  WakeMode,
} from '@zapbip/types';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, test, vi } from 'vitest';
import { openConnector } from '../support/connector-session';
import { receiveOwnerText } from '../support/inbox-session';
import { accountInboxStub } from '../support/workers-env';
import { inboxOf, seedAccount, type SeededAccount } from './route-fixtures';

type MessagesFrame = { type: ConnectorFrameType.Messages; messages: Message[] };

const AGENT = 'ana';
const OWNER_TEXT = 'oi';
const LARGE_MESSAGE_CHARACTERS = 4_000;
const OTHER_AGENT_MESSAGE_ID = 'msg_other';

function ownerMessage(input: { account: SeededAccount }) {
  return receiveOwnerText({ stub: accountInboxStub({ accountId: input.account.accountId }), text: `@${AGENT} ${OWNER_TEXT}` });
}

function unreadCountOf(input: { account: SeededAccount }): Promise<number> {
  return runInDurableObject(accountInboxStub({ accountId: input.account.accountId }), (instance) =>
    (instance as unknown as { dependencies: CoreDependencies }).dependencies.repository.countUnread({ agent: AGENT }),
  );
}

function socketCountOf(input: { account: SeededAccount }): Promise<number> {
  return runInDurableObject(
    accountInboxStub({ accountId: input.account.accountId }),
    (_instance, state) => state.getWebSockets(AGENT).length,
  );
}

function newAccount(): Promise<SeededAccount> {
  return seedAccount({ agent: AGENT });
}

async function registeredAccount(): Promise<SeededAccount> {
  const account = await newAccount();
  await inboxOf({ accountId: account.accountId }).checkInbox({ connection: account.connection });
  return account;
}

describe('connector socket', () => {
  test('sends hello with the previous mode, then the unread messages', async () => {
    const account = await registeredAccount();
    await ownerMessage({ account });
    const session = await openConnector({ secret: account.secret });
    expect(await session.nextFrame()).toEqual({ type: ConnectorFrameType.Hello, agent: AGENT, previousWakeMode: WakeMode.None });
    const frame = (await session.nextFrame()) as MessagesFrame;
    expect(frame.type).toBe(ConnectorFrameType.Messages);
    expect(frame.messages).toHaveLength(1);
    session.socket.close();
  });

  test('pushes an owner message to the live socket', async () => {
    const account = await registeredAccount();
    const session = await openConnector({ secret: account.secret });
    await session.nextFrame();
    const received = await ownerMessage({ account });
    expect(received.ok).toBe(true);
    const frame = (await session.nextFrame()) as MessagesFrame;
    expect(frame.messages.map((message) => message.agent)).toEqual([AGENT]);
    session.socket.close();
  });

  test('leaves the message unread when no connector is attached', async () => {
    const account = await registeredAccount();
    await ownerMessage({ account });
    expect(await unreadCountOf({ account })).toBe(1);
  });

  test('marks a message read on done', async () => {
    const account = await registeredAccount();
    const session = await openConnector({ secret: account.secret });
    await session.nextFrame();
    await ownerMessage({ account });
    const frame = (await session.nextFrame()) as MessagesFrame;
    session.socket.send(JSON.stringify({ type: ConnectorFrameType.Done, messageId: frame.messages[0]?.messageId }));
    await vi.waitFor(async () => expect(await unreadCountOf({ account })).toBe(0));
    session.socket.close();
  });

  test('ignores a done for a message that is not the agent own', async () => {
    const account = await registeredAccount();
    const session = await openConnector({ secret: account.secret });
    await session.nextFrame();
    await ownerMessage({ account });
    await session.nextFrame();
    const pong = new Promise<string>((resolve) => session.socket.addEventListener('message', (event) => resolve(String(event.data))));
    session.socket.send(JSON.stringify({ type: ConnectorFrameType.Done, messageId: OTHER_AGENT_MESSAGE_ID }));
    session.socket.send(CONNECTOR_PING_TEXT);
    await pong;
    expect(await unreadCountOf({ account })).toBe(1);
    session.socket.close();
  });

  test('answers the ping with the pong', async () => {
    const account = await registeredAccount();
    const session = await openConnector({ secret: account.secret });
    await session.nextFrame();
    const pong = new Promise<string>((resolve) => session.socket.addEventListener('message', (event) => resolve(String(event.data))));
    session.socket.send(CONNECTOR_PING_TEXT);
    expect(await pong).toBe(CONNECTOR_PONG_TEXT);
    session.socket.close();
  });

  test.each([
    ['malformed json', 'not json'],
    ['an unknown type', JSON.stringify({ type: 'nope' })],
    ['an oversized frame', 'x'.repeat(CONNECTOR_FRAME_MAX_BYTES + 1)],
    ['a binary frame', new TextEncoder().encode('{"type":"done"}')],
  ])('keeps the socket open after %s', async (_name, payload) => {
    const account = await registeredAccount();
    const session = await openConnector({ secret: account.secret });
    await session.nextFrame();
    session.socket.send(payload);
    await ownerMessage({ account });
    const frame = (await session.nextFrame()) as MessagesFrame;
    expect(frame.type).toBe(ConnectorFrameType.Messages);
    session.socket.close();
  });

  test('a second connect closes the first with the replaced code', async () => {
    const account = await registeredAccount();
    const first = await openConnector({ secret: account.secret });
    await first.nextFrame();
    const second = await openConnector({ secret: account.secret });
    expect(await first.closeCode()).toBe(REPLACED_CLOSE_CODE);
    expect(await second.nextFrame()).toMatchObject({ type: ConnectorFrameType.Hello });
    second.socket.close();
  });

  test('delivers an owner message to exactly one socket after a replacement', async () => {
    const account = await registeredAccount();
    const first = await openConnector({ secret: account.secret });
    await first.nextFrame();
    const second = await openConnector({ secret: account.secret });
    await second.nextFrame();
    await first.closeCode();
    await ownerMessage({ account });
    const frame = (await second.nextFrame()) as MessagesFrame;
    expect(frame.type).toBe(ConnectorFrameType.Messages);
    expect(first.receivedCount()).toBe(0);
    second.socket.close();
  });

  test('a new connect after a dropped socket re-sends the unread messages', async () => {
    const account = await registeredAccount();
    const first = await openConnector({ secret: account.secret });
    await first.nextFrame();
    await ownerMessage({ account });
    await first.nextFrame();
    first.socket.close();
    await vi.waitFor(async () => expect(await socketCountOf({ account })).toBe(0));
    const second = await openConnector({ secret: account.secret });
    expect(await second.nextFrame()).toMatchObject({ type: ConnectorFrameType.Hello });
    const frame = (await second.nextFrame()) as MessagesFrame;
    expect(frame.messages).toHaveLength(1);
    second.socket.close();
  });

  test('after the object restarts a reconnecting connector gets hello and the unread message once', async () => {
    const account = await registeredAccount();
    const first = await openConnector({ secret: account.secret });
    await first.nextFrame();
    await ownerMessage({ account });
    await first.nextFrame();
    await expect(
      runInDurableObject(accountInboxStub({ accountId: account.accountId }), (_instance, state) => state.abort('evicted')),
    ).rejects.toThrow('evicted');
    const second = await openConnector({ secret: account.secret });
    expect(await second.nextFrame()).toEqual({ type: ConnectorFrameType.Hello, agent: AGENT, previousWakeMode: WakeMode.Local });
    const frame = (await second.nextFrame()) as MessagesFrame;
    expect(frame.messages).toHaveLength(1);
    expect(second.receivedCount()).toBe(0);
    second.socket.close();
  });

  test('a backlog over the frame limit reaches the connector in frames that each fit', async () => {
    const account = await registeredAccount();
    const stub = accountInboxStub({ accountId: account.accountId });
    const backlogSize = 20;
    await Promise.all(
      Array.from({ length: backlogSize }, (_, index) =>
        receiveOwnerText({ stub, text: `@${AGENT} ${index} ${'x'.repeat(LARGE_MESSAGE_CHARACTERS)}` }),
      ),
    );
    const session = await openConnector({ secret: account.secret });
    await session.nextFrame();
    const frames: MessagesFrame[] = [];
    while (frames.flatMap((frame) => frame.messages).length < backlogSize) frames.push((await session.nextFrame()) as MessagesFrame);
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame) =>
      expect(new TextEncoder().encode(JSON.stringify(frame)).byteLength).toBeLessThanOrEqual(CONNECTOR_FRAME_MAX_BYTES),
    );
    session.socket.close();
  });
});

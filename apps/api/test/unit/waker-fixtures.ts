import type { AgentName, AgentWaker, Clock, CoreDependencies, Message, WakeDependencies } from '@zapbip/core';
import { createInMemoryWakeRepository, createRecordingWakeObserver, type RecordingWakeObserver } from '@zapbip/core/wake-testing';
import { MessageDirection, MessageKind, WakeOutcome } from '@zapbip/types';
import { vi, type Mock } from 'vitest';

export const CLOCK_START_MS = 1_000_000_000_000;
export const PRIMARY: AgentName = 'agent-ten';
export const STANDBY: AgentName = 'agent-eight';
export const POLLING_AGENT: AgentName = 'agent-nine';
export const OWNER_MESSAGE_ID = 'm1';
export const COPY_MESSAGE_ID = 'copy_1';

export type MutableClock = Clock & { set(input: { now: number }): void };

export type WakerHarness = {
  dependencies: CoreDependencies;
  wake: WakeDependencies;
  clock: MutableClock;
  observer: RecordingWakeObserver;
  findMessage: Mock;
  countUnread: Mock;
  insertHandoff: Mock;
  standbyNotify: Mock<AgentWaker['notify']>;
};

export function createClock(): MutableClock {
  let now = CLOCK_START_MS;
  return {
    now: () => now,
    schedule: () => ({ cancel: () => undefined }),
    set: (input) => {
      now = input.now;
    },
  };
}

export function ownerTextOf(input: { messageId?: string; text?: string }): Message {
  return {
    messageId: input.messageId === undefined ? OWNER_MESSAGE_ID : input.messageId,
    direction: MessageDirection.FromOwner,
    agent: PRIMARY,
    at: CLOCK_START_MS,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    forwarded: false,
    handedTo: null,
    originMessageId: null,
    kind: MessageKind.Text,
    text: input.text === undefined ? 'oi' : input.text,
  };
}

export function createHarness(): WakerHarness {
  const clock = createClock();
  const findMessage = vi.fn().mockResolvedValue(ownerTextOf({}));
  const countUnread = vi.fn().mockResolvedValue(0);
  const insertHandoff = vi.fn().mockResolvedValue(undefined);
  const standbyNotify = vi.fn<AgentWaker['notify']>().mockResolvedValue(WakeOutcome.Woken);
  const dependencies = {
    accountId: 'acc',
    repository: { findMessage, countUnread, insertHandoff },
    clock,
    ids: { next: () => COPY_MESSAGE_ID },
    waker: { notify: standbyNotify },
  } as unknown as CoreDependencies;
  const observer = createRecordingWakeObserver();
  const wake = { repository: createInMemoryWakeRepository({ clock }), observer } as unknown as WakeDependencies;
  return { dependencies, wake, clock, observer, findMessage, countUnread, insertHandoff, standbyNotify };
}

export function firstCallArgument<Argument>(input: { mock: Mock }): Argument {
  const [call] = input.mock.mock.calls;
  if (call === undefined) throw new Error('expected at least one call');
  return call[0] as Argument;
}

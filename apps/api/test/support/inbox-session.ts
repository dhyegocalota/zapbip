import { NOTICE_QUICK_REPLY_ID, type OwnerInboundContent } from '@zapbip/core';
import { MessageKind, OwnerLocale } from '@zapbip/types';
import { runInDurableObject } from 'cloudflare:test';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import type { DurableClock } from '../../src/adapters/platform/clock';
import type { FakeWhatsAppSender } from '../../src/adapters/fake/fake-whatsapp-sender';
import type { ScreenEntry } from '../../src/contract/account-inbox-rpc';
import type { DueTimeProvider } from '../../src/contract/due-time-provider';

type InboxInternals = { sender: FakeWhatsAppSender; clock: DurableClock; dueTimeProviders: DueTimeProvider[] };

let receivedCount = 0;

function internalsOf(instance: AccountInbox): InboxInternals {
  return instance as unknown as InboxInternals;
}

export function nextChannelMessageId(): string {
  receivedCount += 1;
  return `wamid.test.${receivedCount}`;
}

export function receiveOwnerContent(input: {
  stub: DurableObjectStub<AccountInbox>;
  content: OwnerInboundContent;
  channelMessageId?: string;
  replyToMessageId?: string | null;
  forwarded?: boolean;
}) {
  return input.stub.receiveOwnerMessage({
    ownerLocale: OwnerLocale.PortugueseBrazil,
    channelMessageId: input.channelMessageId === undefined ? nextChannelMessageId() : input.channelMessageId,
    ownerMessage: {
      at: Date.now(),
      replyToMessageId: input.replyToMessageId === undefined ? null : input.replyToMessageId,
      forwarded: input.forwarded === true,
      content: input.content,
    },
  });
}

export function receiveOwnerText(input: {
  stub: DurableObjectStub<AccountInbox>;
  text: string;
  channelMessageId?: string;
  forwarded?: boolean;
}) {
  return receiveOwnerContent({
    stub: input.stub,
    content: { kind: MessageKind.Text, text: input.text },
    channelMessageId: input.channelMessageId,
    forwarded: input.forwarded,
  });
}

export function openWindow(input: { stub: DurableObjectStub<AccountInbox> }) {
  return receiveOwnerContent({
    stub: input.stub,
    content: { kind: MessageKind.Choice, optionId: NOTICE_QUICK_REPLY_ID, optionTitle: 'Abrir', optionDescription: null },
  });
}

export function advanceClock(input: { stub: DurableObjectStub<AccountInbox>; advanceMs: number }): Promise<number> {
  return runInDurableObject(input.stub, (instance) => internalsOf(instance).clock.advance({ advanceMs: input.advanceMs }));
}

export function readScreen(input: { stub: DurableObjectStub<AccountInbox> }): Promise<ScreenEntry[]> {
  return runInDurableObject(input.stub, (instance) => internalsOf(instance).sender.listScreenEntries());
}

export function registerDueTimeProvider(input: { stub: DurableObjectStub<AccountInbox>; provider: DueTimeProvider }): Promise<void> {
  return runInDurableObject(input.stub, (instance) => {
    internalsOf(instance).dueTimeProviders.push(input.provider);
  });
}

export function replaceTemplate(input: {
  stub: DurableObjectStub<AccountInbox>;
  template: FakeWhatsAppSender['template'];
}): Promise<FakeWhatsAppSender['template']> {
  return runInDurableObject(input.stub, (instance) => {
    const internals = internalsOf(instance);
    const original = internals.sender.template;
    internals.sender.template = input.template;
    return original;
  });
}

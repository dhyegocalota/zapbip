import type { Clock, MessageSender } from '@zapbip/core';
import type { ScreenEntry } from '../../contract/account-inbox-rpc';

export type FakeWhatsAppSender = MessageSender & { listScreenEntries(): Promise<ScreenEntry[]> };

export function createFakeWhatsAppSender(input: { storage: DurableObjectStorage; clock: Clock }): FakeWhatsAppSender {
  void input;
  throw new Error('createFakeWhatsAppSender is not implemented');
}

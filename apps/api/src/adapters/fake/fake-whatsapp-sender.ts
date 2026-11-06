import type { Clock, MessageSender } from '@zapbip/core';
import type { ScreenEntry } from '../../contract/account-inbox-rpc';

export function createFakeWhatsAppSender(input: {
  storage: DurableObjectStorage;
  clock: Clock;
}): MessageSender & { readScreen(): Promise<ScreenEntry[]> } {
  void input;
  throw new Error('createFakeWhatsAppSender is not implemented');
}

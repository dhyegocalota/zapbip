import type { MessageSender } from '@zapbip/core';
import { AccountInbox } from '../account-inbox/account-inbox';
import type { DurableClock } from '../adapters/platform/clock';
import type { DevAccountInboxRpc, ScreenEntry } from '../contract/account-inbox-rpc';

export class DevAccountInbox extends AccountInbox implements Pick<DevAccountInboxRpc, 'readScreen' | 'advanceClock'> {
  declare protected sender: MessageSender & { readScreen(): Promise<ScreenEntry[]> };
  declare protected clock: DurableClock;

  readScreen(): Promise<ScreenEntry[]> {
    return this.sender.readScreen();
  }

  advanceClock(input: { advanceMs: number }): Promise<number> {
    return this.clock.advance(input);
  }
}

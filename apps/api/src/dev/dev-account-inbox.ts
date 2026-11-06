import { AccountInbox } from '../account-inbox/account-inbox';
import type { DevAccountInboxRpc, ScreenEntry } from '../contract/account-inbox-rpc';

export class DevAccountInbox extends AccountInbox implements Pick<DevAccountInboxRpc, 'readScreen' | 'advanceClock'> {
  readScreen(): Promise<ScreenEntry[]> {
    return this.sender.listScreenEntries();
  }

  advanceClock(input: { advanceMs: number }): Promise<number> {
    return this.clock.advance(input);
  }
}

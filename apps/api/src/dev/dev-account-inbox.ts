import { AccountInbox } from '../account-inbox/account-inbox';
import type { DevAccountInboxRpc, ScreenEntry } from '../contract/account-inbox-rpc';

export class DevAccountInbox extends AccountInbox implements Pick<DevAccountInboxRpc, 'readScreen' | 'advanceClock'> {
  readScreen(): Promise<ScreenEntry[]> {
    throw new Error('readScreen is not implemented');
  }

  advanceClock(input: { advanceMs: number }): Promise<number> {
    void input;
    throw new Error('advanceClock is not implemented');
  }
}

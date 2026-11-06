import type { AgentName, RecordedWakeRequest, ScriptedWakeResponse } from '@zapbip/core';
import { AccountInbox } from '../account-inbox/account-inbox';
import type { DevAccountInboxRpc, ScreenEntry } from '../contract/account-inbox-rpc';

export class DevAccountInbox
  extends AccountInbox
  implements Pick<DevAccountInboxRpc, 'readScreen' | 'advanceClock' | 'devScriptWake' | 'devReadWakeRequests' | 'devRunDueWakes'>
{
  readScreen(): Promise<ScreenEntry[]> {
    return this.sender.listScreenEntries();
  }

  advanceClock(input: { advanceMs: number }): Promise<number> {
    return this.clock.advance(input);
  }

  async devScriptWake(input: { agent: AgentName; responses: ScriptedWakeResponse[] }): Promise<void> {
    void input;
    throw new Error('devScriptWake is not implemented');
  }

  async devReadWakeRequests(input: { agent: AgentName }): Promise<RecordedWakeRequest[]> {
    void input;
    throw new Error('devReadWakeRequests is not implemented');
  }

  async devRunDueWakes(): Promise<void> {
    throw new Error('devRunDueWakes is not implemented');
  }
}

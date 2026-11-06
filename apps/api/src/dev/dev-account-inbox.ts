import type { AgentName, RecordedWakeRequest, ScriptedWakeResponse, WakeTransport } from '@zapbip/core';
import { createScriptedWakeTransport } from '@zapbip/core/wake-testing';
import { AccountInbox } from '../account-inbox/account-inbox';
import type { DevAccountInboxRpc, ScreenEntry } from '../contract/account-inbox-rpc';

export class DevAccountInbox
  extends AccountInbox
  implements Pick<DevAccountInboxRpc, 'readScreen' | 'advanceClock' | 'devScriptWake' | 'devReadWakeRequests' | 'devRunDueWakes'>
{
  private readonly scriptedTransport = createScriptedWakeTransport();

  protected createWakeTransport(): WakeTransport {
    return this.scriptedTransport;
  }

  readScreen(): Promise<ScreenEntry[]> {
    return this.sender.listScreenEntries();
  }

  advanceClock(input: { advanceMs: number }): Promise<number> {
    return this.clock.advance(input);
  }

  async devScriptWake(input: { agent: AgentName; responses: ScriptedWakeResponse[] }): Promise<void> {
    this.scriptedTransport.enqueue(input);
  }

  async devReadWakeRequests(input: { agent: AgentName }): Promise<RecordedWakeRequest[]> {
    return this.scriptedTransport.requestsFor(input);
  }

  async devRunDueWakes(): Promise<void> {
    await this.runDueWakes();
    await this.armAlarm();
  }
}

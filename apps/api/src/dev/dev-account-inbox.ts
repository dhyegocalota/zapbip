import type { MediaStore, MessageSender } from '@zapbip/core';
import { AccountInbox } from '../account-inbox/account-inbox';
import { createFakeWhatsAppSender, type FakeWhatsAppSender } from '../adapters/fake/fake-whatsapp-sender';
import type { DevAccountInboxRpc, ScreenEntry } from '../contract/account-inbox-rpc';

export class DevAccountInbox extends AccountInbox implements Pick<DevAccountInboxRpc, 'readScreen' | 'advanceClock'> {
  private fakeSender: FakeWhatsAppSender | null = null;

  protected createSender(input: { mediaStore: MediaStore }): MessageSender {
    if (this.env.WHATSAPP_ACCESS_TOKEN !== undefined) return super.createSender(input);
    this.fakeSender = createFakeWhatsAppSender({ storage: this.ctx.storage, clock: this.clock });
    return this.fakeSender;
  }

  async readScreen(): Promise<ScreenEntry[]> {
    if (this.fakeSender === null) throw new Error('the simulator screen needs the fake sender');
    return this.fakeSender.listScreenEntries();
  }

  advanceClock(input: { advanceMs: number }): Promise<number> {
    return this.clock.advance(input);
  }
}

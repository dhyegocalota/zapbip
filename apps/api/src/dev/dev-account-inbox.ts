import type { MediaStore, MessageSender } from '@zapbip/core';
import { AccountInbox } from '../account-inbox/account-inbox';
import { createFakeWhatsAppSender, type FakeWhatsAppSender } from '../adapters/fake/fake-whatsapp-sender';
import type { DevAccountInboxRpc, ScreenEntry } from '../contract/account-inbox-rpc';

const CHANNEL_MESSAGE_ID_STATEMENT = 'SELECT channel_message_id FROM inbox_messages WHERE id = ?';

export class DevAccountInbox
  extends AccountInbox
  implements Pick<DevAccountInboxRpc, 'readScreen' | 'advanceClock' | 'channelMessageIdOf'>
{
  private fakeSender: FakeWhatsAppSender | null = null;

  protected createSender(input: { mediaStore: MediaStore }): MessageSender {
    if (this.env.WHATSAPP_ACCESS_TOKEN !== undefined) return super.createSender(input);
    this.fakeSender = createFakeWhatsAppSender({
      storage: this.ctx.storage,
      clock: this.clock,
      mediaStore: input.mediaStore,
      accountId: this.accountId,
      origin: this.env.PUBLIC_ORIGIN,
    });
    return this.fakeSender;
  }

  async readScreen(): Promise<ScreenEntry[]> {
    if (this.fakeSender === null) throw new Error('the simulator screen needs the fake sender');
    return this.fakeSender.listScreenEntries();
  }

  async channelMessageIdOf(input: { messageId: string }): Promise<string | null> {
    const [row] = this.ctx.storage.sql.exec<{ channel_message_id: string | null }>(CHANNEL_MESSAGE_ID_STATEMENT, input.messageId).toArray();
    if (row === undefined) return null;
    return row.channel_message_id;
  }

  advanceClock(input: { advanceMs: number }): Promise<number> {
    return this.clock.advance(input);
  }
}

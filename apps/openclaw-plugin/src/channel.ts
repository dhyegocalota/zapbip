import type { ChannelPlugin } from 'openclaw/plugin-sdk/channel-core';
import type { ZapbipAccount } from './account';

export function createZapbipPlugin(): ChannelPlugin<ZapbipAccount> {
  throw new Error('createZapbipPlugin is not implemented');
}

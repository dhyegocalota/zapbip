import type { Message } from '@zapbip/core';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-contracts';
import type { ZapbipAccount } from './account';

export function handoffTextOf(input: { message: Message }): string {
  throw new Error('handoffTextOf is not implemented');
}

export function handOffToAgent(input: { cfg: OpenClawConfig; account: ZapbipAccount; message: Message }): Promise<void> {
  throw new Error('handOffToAgent is not implemented');
}

import type { ChannelInboundEntry, ReceiveResult } from '@zapbip/core';
import type { OwnerLocale } from '@zapbip/types';
import type { Bindings } from '../contract/env';

export type OwnerInboundEntryRequest = { accountId: string; ownerLocale: OwnerLocale; downloadsMedia: boolean };

export type OwnerInboundInput = {
  bindings: Bindings;
  waId: string;
  channelMessageId: string;
  entryOf: (input: OwnerInboundEntryRequest) => Promise<ChannelInboundEntry>;
};

export function receiveOwnerInbound(input: OwnerInboundInput): Promise<ReceiveResult> {
  throw new Error(`receiveOwnerInbound is not implemented for ${input.channelMessageId}`);
}

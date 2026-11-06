import type { Clock, MediaStore, MessageSender } from '@zapbip/core';
import type { ChannelRestrictions } from '../d1/d1-channel-restrictions';
import type { D1MessageIndex } from '../d1/d1-message-index';
import type { OwnerRecipient } from '../d1/d1-owner-directory';
import type { GraphClient } from './graph-client';

export function createCloudApiMessageSender(input: {
  accountId: string;
  graph: GraphClient;
  findOwnerByAccountId: (input: { accountId: string }) => Promise<OwnerRecipient | null>;
  messageIndex: D1MessageIndex;
  restrictions: ChannelRestrictions;
  mediaStore: MediaStore;
  publicOrigin: string;
  phoneNumberId: string;
  clock: Clock;
}): MessageSender {
  void input;
  throw new Error('createCloudApiMessageSender is not implemented');
}

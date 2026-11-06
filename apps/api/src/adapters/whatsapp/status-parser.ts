import type { ChannelStatusDetail } from '@zapbip/core';
import type { DeliveryState } from '@zapbip/types';

export type ParsedStatus = {
  channelMessageId: string;
  status: DeliveryState.Sent | DeliveryState.Delivered | DeliveryState.Read | DeliveryState.Failed | null;
  detail: ChannelStatusDetail;
  timestamp: number;
};

export function parseStatusItems(input: { rawStatuses: unknown }): ParsedStatus[] {
  void input;
  throw new Error('parseStatusItems is not implemented');
}

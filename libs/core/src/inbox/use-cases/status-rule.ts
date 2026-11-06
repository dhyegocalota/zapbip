import type { DeliveryState } from '@zapbip/types';
import type { ChannelStatusDetail } from '../inbox-records';
import type { ApplyStatusInput } from './types';

export function applyStatusRule(input: { current: DeliveryState; incoming: ApplyStatusInput['status'] }): {
  next: DeliveryState | null;
  logged: boolean;
} {
  void input;
  throw new Error('applyStatusRule is not implemented');
}

export function mergeChannelStatusDetail(input: { stored: ChannelStatusDetail; incoming: ChannelStatusDetail }): ChannelStatusDetail {
  void input;
  throw new Error('mergeChannelStatusDetail is not implemented');
}

import { DeliveryState } from '@zapbip/types';
import type { ChannelStatusDetail } from '../inbox-records';
import type { ApplyStatusInput } from './types';

const STATUS_RANK: Record<DeliveryState, number | null> = {
  [DeliveryState.Queued]: null,
  [DeliveryState.Sending]: null,
  [DeliveryState.Expired]: null,
  [DeliveryState.Failed]: null,
  [DeliveryState.Sent]: 1,
  [DeliveryState.Delivered]: 2,
  [DeliveryState.Read]: 3,
};

const SETTLED_STATES: DeliveryState[] = [DeliveryState.Delivered, DeliveryState.Read];
const UNCHANGED = { next: null, logged: false };

export function applyStatusRule(input: { current: DeliveryState; incoming: ApplyStatusInput['status'] }): {
  next: DeliveryState | null;
  logged: boolean;
} {
  const { current, incoming } = input;
  const currentRank = STATUS_RANK[current];
  if (incoming === DeliveryState.Failed && current === DeliveryState.Sent) return { next: DeliveryState.Failed, logged: false };
  if (incoming === DeliveryState.Failed) return { next: null, logged: SETTLED_STATES.includes(current) };
  if (current === DeliveryState.Failed) return { next: incoming, logged: false };
  const incomingRank = STATUS_RANK[incoming];
  const isHigherRank = currentRank !== null && incomingRank !== null && incomingRank > currentRank;
  if (isHigherRank) return { next: incoming, logged: false };
  return UNCHANGED;
}

function preferIncoming<Value>(input: { stored: Value | null; incoming: Value | null }): Value | null {
  return input.incoming === null ? input.stored : input.incoming;
}

export function mergeChannelStatusDetail(input: { stored: ChannelStatusDetail; incoming: ChannelStatusDetail }): ChannelStatusDetail {
  const { stored, incoming } = input;
  return {
    errorCode: preferIncoming({ stored: stored.errorCode, incoming: incoming.errorCode }),
    errorTitle: preferIncoming({ stored: stored.errorTitle, incoming: incoming.errorTitle }),
    pricingCategory: preferIncoming({ stored: stored.pricingCategory, incoming: incoming.pricingCategory }),
    billable: preferIncoming({ stored: stored.billable, incoming: incoming.billable }),
  };
}

import { DeliveryState } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { ChannelStatusDetail } from '../inbox-records';
import { applyStatusRule, mergeChannelStatusDetail } from './status-rule';

const EMPTY_DETAIL: ChannelStatusDetail = { errorCode: null, errorTitle: null, pricingCategory: null, billable: null };

type Incoming = Parameters<typeof applyStatusRule>[0]['incoming'];

const RULE_ROWS: { name: string; current: DeliveryState; incoming: Incoming; next: DeliveryState | null; logged: boolean }[] = [
  {
    name: 'CU-1 sent then delivered',
    current: DeliveryState.Sent,
    incoming: DeliveryState.Delivered,
    next: DeliveryState.Delivered,
    logged: false,
  },
  { name: 'CU-2 sent then read', current: DeliveryState.Sent, incoming: DeliveryState.Read, next: DeliveryState.Read, logged: false },
  {
    name: 'CU-3 delivered then read',
    current: DeliveryState.Delivered,
    incoming: DeliveryState.Read,
    next: DeliveryState.Read,
    logged: false,
  },
  { name: 'CU-4 read then delivered', current: DeliveryState.Read, incoming: DeliveryState.Delivered, next: null, logged: false },
  { name: 'CU-5 sent then failed', current: DeliveryState.Sent, incoming: DeliveryState.Failed, next: DeliveryState.Failed, logged: false },
  { name: 'CU-6 delivered then failed', current: DeliveryState.Delivered, incoming: DeliveryState.Failed, next: null, logged: true },
  { name: 'CU-7 read then failed', current: DeliveryState.Read, incoming: DeliveryState.Failed, next: null, logged: true },
  { name: 'CU-8 failed then sent', current: DeliveryState.Failed, incoming: DeliveryState.Sent, next: DeliveryState.Sent, logged: false },
  {
    name: 'CU-9 failed then delivered',
    current: DeliveryState.Failed,
    incoming: DeliveryState.Delivered,
    next: DeliveryState.Delivered,
    logged: false,
  },
  { name: 'CU-10 failed then read', current: DeliveryState.Failed, incoming: DeliveryState.Read, next: DeliveryState.Read, logged: false },
  { name: 'CU-11 read then read', current: DeliveryState.Read, incoming: DeliveryState.Read, next: null, logged: false },
  { name: 'CU-12 queued then delivered', current: DeliveryState.Queued, incoming: DeliveryState.Delivered, next: null, logged: false },
  { name: 'failed then failed', current: DeliveryState.Failed, incoming: DeliveryState.Failed, next: null, logged: false },
  { name: 'sent then sent', current: DeliveryState.Sent, incoming: DeliveryState.Sent, next: null, logged: false },
];

describe('applyStatusRule', () => {
  test.each(RULE_ROWS)('$name', ({ current, incoming, next, logged }) => {
    expect(applyStatusRule({ current, incoming })).toEqual({ next, logged });
  });
});

describe('mergeChannelStatusDetail', () => {
  test('CU-39 a null never overwrites a stored value', () => {
    const stored = { ...EMPTY_DETAIL, errorCode: 131026 };
    const incoming = { ...EMPTY_DETAIL, pricingCategory: 'service' };
    expect(mergeChannelStatusDetail({ stored, incoming })).toEqual({ ...EMPTY_DETAIL, errorCode: 131026, pricingCategory: 'service' });
  });

  test('a non-null value replaces the stored one, false included', () => {
    const stored = { ...EMPTY_DETAIL, billable: true, errorTitle: 'old' };
    const incoming = { ...EMPTY_DETAIL, billable: false, errorTitle: 'new' };
    expect(mergeChannelStatusDetail({ stored, incoming })).toEqual({ ...EMPTY_DETAIL, billable: false, errorTitle: 'new' });
  });
});

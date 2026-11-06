import { DeliveryState } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { parseStatusItems } from '../../src/adapters/whatsapp/status-parser';
import deliveredFixture from '../fixtures/whatsapp/status/delivered.json';
import failedFixture from '../fixtures/whatsapp/status/failed.json';
import playedFixture from '../fixtures/whatsapp/status/played.json';
import readFixture from '../fixtures/whatsapp/status/read.json';
import sentFixture from '../fixtures/whatsapp/status/sent.json';

const EMPTY_DETAIL = { errorCode: null, errorTitle: null, pricingCategory: null, billable: null };

describe('parseStatusItems', () => {
  it('AU-36 parses sent with an empty detail and the timestamp in milliseconds', () => {
    expect(parseStatusItems({ rawStatuses: [sentFixture] })).toEqual([
      { channelMessageId: 'wamid.SENT', status: DeliveryState.Sent, detail: EMPTY_DETAIL, timestamp: 1_762_430_400_000 },
    ]);
  });

  it('AU-37 parses delivered with its pricing', () => {
    expect(parseStatusItems({ rawStatuses: [deliveredFixture] })).toEqual([
      {
        channelMessageId: 'wamid.DELIVERED',
        status: DeliveryState.Delivered,
        detail: { ...EMPTY_DETAIL, pricingCategory: 'service', billable: false },
        timestamp: 1_762_430_401_000,
      },
    ]);
  });

  it('AU-38 parses read', () => {
    const [parsed] = parseStatusItems({ rawStatuses: [readFixture] });
    expect(parsed?.status).toBe(DeliveryState.Read);
  });

  it('AU-56 parses played as a null status without throwing', () => {
    const [parsed] = parseStatusItems({ rawStatuses: [playedFixture] });
    expect(parsed).toMatchObject({ channelMessageId: 'wamid.PLAYED', status: null });
  });

  it('AU-57 parses failed with the first error code and title', () => {
    expect(parseStatusItems({ rawStatuses: [failedFixture] })).toEqual([
      {
        channelMessageId: 'wamid.FAILED',
        status: DeliveryState.Failed,
        detail: { ...EMPTY_DETAIL, errorCode: 131026, errorTitle: 'Message undeliverable' },
        timestamp: 1_762_430_404_000,
      },
    ]);
  });

  it('takes only the first error', () => {
    const [parsed] = parseStatusItems({
      rawStatuses: [
        {
          ...failedFixture,
          errors: [
            { code: 1, title: 'First' },
            { code: 2, title: 'Second' },
          ],
        },
      ],
    });
    expect(parsed?.detail).toMatchObject({ errorCode: 1, errorTitle: 'First' });
  });

  it('AU-58 drops a status with an invalid timestamp and keeps the others', () => {
    const parsed = parseStatusItems({ rawStatuses: [{ ...sentFixture, timestamp: 'abc' }, readFixture] });
    expect(parsed.map((status) => status.channelMessageId)).toEqual(['wamid.READ']);
  });

  it('drops a status outside the vocabulary and keeps the others', () => {
    const parsed = parseStatusItems({ rawStatuses: [{ ...sentFixture, status: 'teleported' }, readFixture] });
    expect(parsed.map((status) => status.channelMessageId)).toEqual(['wamid.READ']);
  });

  it('parses a numeric timestamp', () => {
    const [parsed] = parseStatusItems({ rawStatuses: [{ ...sentFixture, timestamp: 1_762_430_400 }] });
    expect(parsed?.timestamp).toBe(1_762_430_400_000);
  });

  it('returns no items for an empty list', () => {
    expect(parseStatusItems({ rawStatuses: [] })).toEqual([]);
  });
});

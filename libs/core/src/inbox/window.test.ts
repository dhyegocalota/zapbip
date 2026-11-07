import { DAY_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { WINDOW_MS, WINDOW_SAFETY_MARGIN_MS } from './constants';
import { isOwnerWindowOpen } from './window';

const LAST_OWNER_MESSAGE_AT = 1_000_000;

function windowAt(lastOwnerMessageAt: number | null, closedAt: number | null = null) {
  return {
    lastOwnerMessageAt,
    noticeSentForClosedWindow: false,
    closedAt,
    noticeRetryLocale: null,
    noticeRetryAt: null,
    noticeRetryAttempt: 0,
  };
}

describe('isOwnerWindowOpen', () => {
  test('CU-62 closed when the owner never wrote', () => {
    expect(isOwnerWindowOpen({ window: windowAt(null), now: 0 })).toBe(false);
  });

  test('CU-63 open one millisecond after the last message', () => {
    expect(isOwnerWindowOpen({ window: windowAt(LAST_OWNER_MESSAGE_AT), now: LAST_OWNER_MESSAGE_AT + 1 })).toBe(true);
  });

  test('CU-64 open one millisecond before the closing boundary', () => {
    const now = LAST_OWNER_MESSAGE_AT + WINDOW_MS - WINDOW_SAFETY_MARGIN_MS - 1;
    expect(isOwnerWindowOpen({ window: windowAt(LAST_OWNER_MESSAGE_AT), now })).toBe(true);
  });

  test('CU-65 closed exactly at the closing boundary', () => {
    const now = LAST_OWNER_MESSAGE_AT + WINDOW_MS - WINDOW_SAFETY_MARGIN_MS;
    expect(isOwnerWindowOpen({ window: windowAt(LAST_OWNER_MESSAGE_AT), now })).toBe(false);
  });

  test('CU-66 closed long after the last message', () => {
    expect(isOwnerWindowOpen({ window: windowAt(LAST_OWNER_MESSAGE_AT), now: LAST_OWNER_MESSAGE_AT + 2 * DAY_MS })).toBe(false);
  });

  test('CU-13 closed once the channel reported it closed', () => {
    expect(isOwnerWindowOpen({ window: windowAt(LAST_OWNER_MESSAGE_AT, LAST_OWNER_MESSAGE_AT + 1), now: LAST_OWNER_MESSAGE_AT + 2 })).toBe(
      false,
    );
  });

  test('CU-14 an absent closing fact keeps the boundary arithmetic', () => {
    const now = LAST_OWNER_MESSAGE_AT + WINDOW_MS - WINDOW_SAFETY_MARGIN_MS - 1;
    expect(isOwnerWindowOpen({ window: windowAt(LAST_OWNER_MESSAGE_AT, null), now })).toBe(true);
  });

  test('open before the reported closing instant', () => {
    expect(isOwnerWindowOpen({ window: windowAt(LAST_OWNER_MESSAGE_AT, LAST_OWNER_MESSAGE_AT + 5), now: LAST_OWNER_MESSAGE_AT + 4 })).toBe(
      true,
    );
  });

  test('a reported closing with no owner message stays closed and does not throw', () => {
    expect(isOwnerWindowOpen({ window: windowAt(null, 1), now: 0 })).toBe(false);
  });
});

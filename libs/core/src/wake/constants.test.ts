import { describe, expect, test } from 'vitest';
import { SAFETY_NET_CRON, SCHEDULED_MAX_INTERVAL_MINUTES, SCHEDULED_MIN_INTERVAL_MINUTES, STALE_POLL_INTERVAL_MULTIPLE } from './constants';

describe('scheduled wake constants', () => {
  test.each([
    ['SCHEDULED_MIN_INTERVAL_MINUTES', SCHEDULED_MIN_INTERVAL_MINUTES, 1],
    ['SCHEDULED_MAX_INTERVAL_MINUTES', SCHEDULED_MAX_INTERVAL_MINUTES, 1440],
    ['STALE_POLL_INTERVAL_MULTIPLE', STALE_POLL_INTERVAL_MULTIPLE, 2],
    ['SAFETY_NET_CRON', SAFETY_NET_CRON, '0 * * * *'],
  ])('pin: %s', (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

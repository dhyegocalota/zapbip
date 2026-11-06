import { expect, test } from 'vitest';
import { SECOND_MS } from '@zapbip/types';
import {
  WAKE_BACKOFF_BASE_MS,
  WAKE_BACKOFF_CAP_MS,
  WAKE_DEBOUNCE_MS,
  WAKE_LEASE_MS,
  WAKE_MAX_ATTEMPTS,
  WAKE_MIN_INTERVAL_MS,
  WAKE_REQUEST_TIMEOUT_MS,
  WAKE_URL_MAX_CHARS,
} from './constants';

test('the wake constants match the spec', () => {
  expect({
    debounce: WAKE_DEBOUNCE_MS,
    requestTimeout: WAKE_REQUEST_TIMEOUT_MS,
    lease: WAKE_LEASE_MS,
    backoffBase: WAKE_BACKOFF_BASE_MS,
    backoffCap: WAKE_BACKOFF_CAP_MS,
    maxAttempts: WAKE_MAX_ATTEMPTS,
    minInterval: WAKE_MIN_INTERVAL_MS,
    urlMaxChars: WAKE_URL_MAX_CHARS,
  }).toEqual({
    debounce: 3 * SECOND_MS,
    requestTimeout: 10 * SECOND_MS,
    lease: 15 * SECOND_MS,
    backoffBase: 5 * SECOND_MS,
    backoffCap: 60 * SECOND_MS,
    maxAttempts: 5,
    minInterval: 60 * SECOND_MS,
    urlMaxChars: 512,
  });
});

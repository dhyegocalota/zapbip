import { describe, expect, test } from 'vitest';
import { WAKE_SIGNAL_BODY } from './constants';
import { signWakeRequest } from './sign-wake-request';

describe('signWakeRequest', () => {
  test('joins the timestamp and the body with one dot', () => {
    expect(signWakeRequest({ timestampSeconds: 1767225600, body: WAKE_SIGNAL_BODY })).toBe('1767225600.{"event":"inbox_has_messages"}');
  });

  test('keeps a body that contains dots untouched', () => {
    expect(signWakeRequest({ timestampSeconds: 1, body: 'a.b' })).toBe('1.a.b');
  });
});

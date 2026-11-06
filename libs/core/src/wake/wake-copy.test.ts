import { OwnerLocale, WakeCopyKey } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../inbox/testing/capture-inbox-error';
import { WAKE_COPY, wakeFailedCopy } from './wake-copy';

describe('WAKE_COPY', () => {
  test('every key has text in every locale', () => {
    Object.values(WakeCopyKey).forEach((key) =>
      Object.values(OwnerLocale).forEach((locale) => expect(WAKE_COPY[key][locale].length).toBeGreaterThan(0)),
    );
  });

  test('every text names set_wake', () => {
    Object.values(OwnerLocale).forEach((locale) => expect(WAKE_COPY[WakeCopyKey.WakeFailed][locale]).toContain('set_wake'));
  });
});

describe('wakeFailedCopy', () => {
  test('returns the text of the requested locale', () => {
    Object.values(OwnerLocale).forEach((locale) => expect(wakeFailedCopy({ locale })).toBe(WAKE_COPY[WakeCopyKey.WakeFailed][locale]));
  });

  test('an unknown locale throws instead of falling back', async () => {
    const error = await captureInboxError(() => wakeFailedCopy({ locale: undefined as unknown as OwnerLocale }));
    expect(error.message).toBe('wake: unknown locale');
  });
});

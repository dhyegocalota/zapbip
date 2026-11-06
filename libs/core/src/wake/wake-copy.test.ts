import { HOUR_MS, MINUTE_MS, OwnerLocale, WakeCopyKey } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../inbox/testing/capture-inbox-error';
import { expectedDelayNoteCopy, staleNoticeCopy, WAKE_COPY, wakeFailedCopy } from './wake-copy';

const AGENT = 'chatgpt';

function note(input: { intervalMinutes: number; elapsedSinceLastPollMs: number | null; locale?: OwnerLocale }) {
  const { intervalMinutes, elapsedSinceLastPollMs, locale = OwnerLocale.PortugueseBrazil } = input;
  return expectedDelayNoteCopy({ locale, agent: AGENT, intervalMinutes, elapsedSinceLastPollMs });
}

describe('expectedDelayNoteCopy', () => {
  test('names the agent, the hourly cadence and the minutes since the last poll', () => {
    const text = note({ intervalMinutes: 60, elapsedSinceLastPollMs: 12 * MINUTE_MS });
    expect(text).toContain(AGENT);
    expect(text).toContain('de hora em hora');
    expect(text).toContain('há 12 min');
  });

  test.each([
    [120, 'a cada 2 horas'],
    [90, 'a cada 90 minutos'],
  ])('an interval of %i minutes reads %s', (intervalMinutes, cadence) => {
    expect(note({ intervalMinutes, elapsedSinceLastPollMs: MINUTE_MS })).toContain(cadence);
  });

  test.each([
    [0, 'há 0 min'],
    [59 * MINUTE_MS, 'há 59 min'],
    [60 * MINUTE_MS, 'há 1 h'],
    [125 * MINUTE_MS, 'há 2 h'],
  ])('%i ms since the last poll reads %s', (elapsedSinceLastPollMs, elapsed) => {
    expect(note({ intervalMinutes: 60, elapsedSinceLastPollMs })).toContain(elapsed);
  });

  test('a connection that never polled says so', () => {
    expect(note({ intervalMinutes: 60, elapsedSinceLastPollMs: null })).toContain('Ainda não olhou a caixa');
  });

  test('speaks English to an en-US owner', () => {
    const text = note({ intervalMinutes: 60, elapsedSinceLastPollMs: 12 * MINUTE_MS, locale: OwnerLocale.EnglishUs });
    expect(text).toContain('every hour');
    expect(text).toContain('12 min ago');
  });

  test('says in English that the inbox was never checked', () => {
    const text = note({ intervalMinutes: 60, elapsedSinceLastPollMs: null, locale: OwnerLocale.EnglishUs });
    expect(text).toContain('has not checked the inbox yet');
  });
});

describe('staleNoticeCopy', () => {
  test('names the agent and the hours since the last poll', () => {
    const text = staleNoticeCopy({ locale: OwnerLocale.PortugueseBrazil, agent: AGENT, elapsedSinceLastPollMs: 3 * HOUR_MS });
    expect(text).toContain(AGENT);
    expect(text).toContain('há 3 h');
  });
});

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

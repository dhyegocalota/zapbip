import { HOUR_MS, MINUTE_MS, OwnerLocale, WakeCopyKey } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AGENT_NAME_MAX_CHARS, NOTICE_PREVIEW_MAX_CHARS } from '../inbox/constants';
import { captureInboxError } from '../inbox/testing/capture-inbox-error';
import { expectedDelayNoteCopy, staleNoticeCopy, WAKE_COPY, wakeFailedCopy } from './wake-copy';

const AGENT = 'agent-nine';

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
    [OwnerLocale.PortugueseBrazil, 1, 'a cada minuto'],
    [OwnerLocale.PortugueseBrazil, 2, 'a cada 2 minutos'],
    [OwnerLocale.EnglishUs, 1, 'every minute'],
    [OwnerLocale.EnglishUs, 2, 'every 2 minutes'],
  ])('%s with an interval of %i minutes reads %s', (locale, intervalMinutes, cadence) => {
    expect(note({ intervalMinutes, elapsedSinceLastPollMs: MINUTE_MS, locale })).toContain(cadence);
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

  test.each([
    [OwnerLocale.PortugueseBrazil, 'há 2 h'],
    [OwnerLocale.EnglishUs, 'in 2 h'],
  ])('%s keeps the longest agent name and the elapsed time inside the template preview', (locale, elapsed) => {
    const agent = 'a'.repeat(AGENT_NAME_MAX_CHARS);
    const preview = staleNoticeCopy({ locale, agent, elapsedSinceLastPollMs: 2 * HOUR_MS }).slice(0, NOTICE_PREVIEW_MAX_CHARS);
    expect(preview).toContain(agent);
    expect(preview).toContain(elapsed);
  });

  test.each([
    [OwnerLocale.PortugueseBrazil, 'ainda não checou'],
    [OwnerLocale.EnglishUs, "hasn't checked yet"],
  ])('%s says a never-polled agent has not checked yet', (locale, never) => {
    expect(staleNoticeCopy({ locale, agent: AGENT, elapsedSinceLastPollMs: null })).toContain(never);
  });
});

const FAILED_WAKE_AGENT = 'alpha';

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

describe('WAKE_COPY facts', () => {
  test('every text names the agent that could not be woken', () => {
    Object.values(OwnerLocale).forEach((locale) => expect(WAKE_COPY[WakeCopyKey.WakeFailed][locale]).toContain('{agent}'));
  });
});

describe('wakeFailedCopy', () => {
  test('returns the text of the requested locale', () => {
    Object.values(OwnerLocale).forEach((locale) =>
      expect(wakeFailedCopy({ locale, agent: FAILED_WAKE_AGENT })).toBe(
        WAKE_COPY[WakeCopyKey.WakeFailed][locale].replace('{agent}', FAILED_WAKE_AGENT),
      ),
    );
  });

  test('names the agent in every locale', () => {
    Object.values(OwnerLocale).forEach((locale) =>
      expect(wakeFailedCopy({ locale, agent: FAILED_WAKE_AGENT })).toContain(FAILED_WAKE_AGENT),
    );
  });

  test('an unknown locale throws instead of falling back', async () => {
    const error = await captureInboxError(() => wakeFailedCopy({ locale: undefined as unknown as OwnerLocale, agent: FAILED_WAKE_AGENT }));
    expect(error.message).toBe('wake: unknown locale');
  });
});

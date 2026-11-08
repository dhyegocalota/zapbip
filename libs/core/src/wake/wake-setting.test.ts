import { InboxErrorCode, WakeMode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../inbox/testing/capture-inbox-error';
import { SCHEDULED_MAX_INTERVAL_MINUTES, SCHEDULED_MIN_INTERVAL_MINUTES } from './constants';
import { storedWakeOf } from './testing/wake-doubles';
import { assertWakeSetting, type StoredWake, type WakeSettingInput } from './wake-setting';

const CALLER = 'agent-ten';
const STANDBY_AGENT = 'agent-eight';
const SCHEDULED_SETTING: WakeSettingInput = { mode: WakeMode.Scheduled, url: null, token: null, intervalMinutes: 60, standbyAgent: null };
const STANDBY_SETTING: WakeSettingInput = {
  mode: WakeMode.Standby,
  url: null,
  token: null,
  intervalMinutes: null,
  standbyAgent: STANDBY_AGENT,
};

function rejection(input: { setting: WakeSettingInput; standby?: StoredWake | null }) {
  const { setting, standby = null } = input;
  return captureInboxError(() => assertWakeSetting({ setting, caller: CALLER, standby }));
}

describe('assertWakeSetting scheduled', () => {
  test.each([SCHEDULED_MIN_INTERVAL_MINUTES, 60, SCHEDULED_MAX_INTERVAL_MINUTES])(
    'an interval of %i minutes is accepted',
    (intervalMinutes) => {
      expect(() => assertWakeSetting({ setting: { ...SCHEDULED_SETTING, intervalMinutes }, caller: CALLER, standby: null })).not.toThrow();
    },
  );

  test.each([
    [0, '1'],
    [SCHEDULED_MAX_INTERVAL_MINUTES + 1, '1440'],
    [90.5, 'whole number'],
    [-60, 'interval_minutes'],
    [null, 'interval_minutes'],
  ])('an interval of %s is refused naming interval_minutes and %s', async (intervalMinutes, limit) => {
    const error = await rejection({ setting: { ...SCHEDULED_SETTING, intervalMinutes } });
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain('interval_minutes');
    expect(error.message).toContain(limit);
  });

  test.each([
    ['url', { url: 'https://hooks.example.com/zapbip' }],
    ['standby_agent', { standbyAgent: STANDBY_AGENT }],
  ])('a scheduled wake with %s is refused', async (field, foreign) => {
    const error = await rejection({ setting: { ...SCHEDULED_SETTING, ...foreign } });
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain(field);
    expect(error.message).toContain(WakeMode.Scheduled);
  });
});

describe('assertWakeSetting standby', () => {
  test('a connected standby that is not in standby mode is accepted', () => {
    const standby = storedWakeOf({ agent: STANDBY_AGENT, mode: WakeMode.Webhook });
    expect(() => assertWakeSetting({ setting: STANDBY_SETTING, caller: CALLER, standby })).not.toThrow();
  });

  test('the caller as its own standby is refused', async () => {
    const error = await rejection({
      setting: { ...STANDBY_SETTING, standbyAgent: CALLER },
      standby: storedWakeOf({ agent: CALLER, mode: WakeMode.Webhook }),
    });
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain('standby_agent');
    expect(error.message).toContain('itself');
  });

  test('an unknown or revoked standby is refused with the same text', async () => {
    const error = await rejection({ setting: STANDBY_SETTING, standby: null });
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain('standby_agent');
    expect(error.message).toContain('not connected to this account');
  });

  test('a standby in standby mode is refused as one hop', async () => {
    const error = await rejection({ setting: STANDBY_SETTING, standby: storedWakeOf({ agent: STANDBY_AGENT, mode: WakeMode.Standby }) });
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain('standby_agent');
    expect(error.message).toContain('one hop');
  });

  test('a missing standby name is refused', async () => {
    const error = await rejection({ setting: { ...STANDBY_SETTING, standbyAgent: null } });
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain('standby_agent');
  });

  test.each([
    ['interval_minutes', { intervalMinutes: 60 }],
    ['token', { token: 'x'.repeat(16) }],
  ])('a standby wake with %s is refused', async (field, foreign) => {
    const error = await rejection({
      setting: { ...STANDBY_SETTING, ...foreign },
      standby: storedWakeOf({ agent: STANDBY_AGENT, mode: WakeMode.Webhook }),
    });
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain(field);
    expect(error.message).toContain(WakeMode.Standby);
  });
});

describe('assertWakeSetting foreign fields', () => {
  const FOREIGN_FIELDS = [
    ['url', { url: 'https://hooks.example.com/zapbip' }],
    ['token', { token: 'x'.repeat(16) }],
    ['interval_minutes', { intervalMinutes: 5 }],
    ['standby_agent', { standbyAgent: STANDBY_AGENT }],
  ] as const;

  describe.each([WakeMode.None, WakeMode.Local])('%s', (mode) => {
    test.each(FOREIGN_FIELDS)('a foreign %s is refused', async (field, foreign) => {
      const error = await rejection({ setting: { mode, url: null, token: null, intervalMinutes: null, standbyAgent: null, ...foreign } });
      expect(error.code).toBe(InboxErrorCode.InvalidInput);
      expect(error.message).toContain(field);
      expect(error.message).toContain(mode);
    });
  });

  test.each([FOREIGN_FIELDS[2], FOREIGN_FIELDS[3]])('a webhook wake with a foreign %s is refused', async (field, foreign) => {
    const error = await rejection({
      setting: {
        mode: WakeMode.Webhook,
        url: 'https://hooks.example.com/zapbip',
        token: 'x'.repeat(16),
        intervalMinutes: null,
        standbyAgent: null,
        ...foreign,
      },
    });
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain(field);
    expect(error.message).toContain(WakeMode.Webhook);
  });

  test('a standby name outside the agent-name pattern is refused', async () => {
    const error = await rejection({
      setting: { ...STANDBY_SETTING, standbyAgent: 'Grok Bot!' },
      standby: storedWakeOf({ agent: 'Grok Bot!', mode: WakeMode.Webhook }),
    });
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain('standby_agent');
    expect(error.message).toContain('must match');
  });
});

describe('assertWakeSetting none', () => {
  test('the none mode is accepted', () => {
    const setting: WakeSettingInput = { mode: WakeMode.None, url: null, token: null, intervalMinutes: null, standbyAgent: null };
    expect(() => assertWakeSetting({ setting, caller: CALLER, standby: null })).not.toThrow();
  });
});

describe('WakeMode values', () => {
  test('pin: scheduled and standby appear exactly once', () => {
    const values = Object.values(WakeMode);
    expect(values.filter((value) => value === WakeMode.Scheduled)).toHaveLength(1);
    expect(values.filter((value) => value === WakeMode.Standby)).toHaveLength(1);
  });
});

import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import * as contractConstants from '../../src/contract/constants';
import { LogEvent } from '../../src/contract/log';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';

const BACKOFFICE_LOG_EVENTS = [
  'backoffice.sign_in_failed',
  'backoffice.sign_in_succeeded',
  'backoffice.locked',
  'backoffice.csrf_rejected',
  'backoffice.number_changed',
  'backoffice.error',
];
const NUMBER_OPERATOR_EVENTS = [
  'inbound.unattributed',
  'inbound.number_pending',
  'inbound.number_disabled',
  'inbound.account_on_other_number',
  'inbound.number_closed',
  'channel.number_unavailable',
];

describe('the platform contract of the backoffice', () => {
  it('logs the backoffice events', () => {
    expect(Object.values(LogEvent)).toEqual(expect.arrayContaining(BACKOFFICE_LOG_EVENTS));
  });

  it('logs the number events the channel raises', () => {
    expect(Object.values(OperatorEvent)).toEqual(expect.arrayContaining(NUMBER_OPERATOR_EVENTS));
  });

  it('fixes the session, lockout, audit and one-time-password constants', () => {
    expect(contractConstants).toMatchObject({
      BACKOFFICE_SESSION_IDLE_MS: 30 * MINUTE_MS,
      BACKOFFICE_SESSION_MAX_MS: 8 * HOUR_MS,
      BACKOFFICE_LOCKOUT_THRESHOLD: 10,
      BACKOFFICE_LOCKOUT_MS: 15 * MINUTE_MS,
      BACKOFFICE_AUDIT_RETENTION_MS: 365 * DAY_MS,
      TOTP_PERIOD_MS: 30 * SECOND_MS,
      TOTP_DIGITS: 6,
      TOTP_WINDOW_STEPS: 1,
    });
  });
});

import { HOUR_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { D1ChannelRestrictions } from '../../src/adapters/d1/d1-channel-restrictions';
import { RESTRICTION_TTL_MS } from '../../src/adapters/whatsapp/whatsapp-constants';
import { applyDirectoryMigration, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';

const PHONE_NUMBER_ID = '1000000000000001';
const OTHER_PHONE_NUMBER_ID = '1000000000000002';
const SPAM_RATE_LIMIT_CODE = 131048;
const RESTRICTED_CODE = 368;
const INJECTION_PHONE_NUMBER_ID = "1'; DROP TABLE channel_restrictions; --";

function restrictions(input: { phoneNumberId?: string } = {}): D1ChannelRestrictions {
  return new D1ChannelRestrictions({
    database: testEnv.CONNECTIONS,
    phoneNumberId: input.phoneNumberId === undefined ? PHONE_NUMBER_ID : input.phoneNumberId,
  });
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('D1 channel restrictions', () => {
  it('finds nothing when no restriction was recorded', async () => {
    expect(await restrictions().findActive({ now: SEED_CREATED_AT })).toBeNull();
  });

  it('finds a recorded restriction with its error code', async () => {
    await restrictions().record({ errorCode: SPAM_RATE_LIMIT_CODE, restrictedAt: SEED_CREATED_AT });
    expect(await restrictions().findActive({ now: SEED_CREATED_AT + HOUR_MS })).toEqual({ errorCode: SPAM_RATE_LIMIT_CODE });
  });

  it('still finds the restriction just before the TTL', async () => {
    await restrictions().record({ errorCode: SPAM_RATE_LIMIT_CODE, restrictedAt: SEED_CREATED_AT });
    expect(await restrictions().findActive({ now: SEED_CREATED_AT + RESTRICTION_TTL_MS - 1 })).toEqual({
      errorCode: SPAM_RATE_LIMIT_CODE,
    });
  });

  it('ignores the restriction at the TTL and after it', async () => {
    await restrictions().record({ errorCode: SPAM_RATE_LIMIT_CODE, restrictedAt: SEED_CREATED_AT });
    expect(await restrictions().findActive({ now: SEED_CREATED_AT + RESTRICTION_TTL_MS })).toBeNull();
    expect(await restrictions().findActive({ now: SEED_CREATED_AT + RESTRICTION_TTL_MS + HOUR_MS })).toBeNull();
  });

  it('replaces the stored restriction and restarts the TTL when recorded again', async () => {
    await restrictions().record({ errorCode: SPAM_RATE_LIMIT_CODE, restrictedAt: SEED_CREATED_AT });
    await restrictions().record({ errorCode: RESTRICTED_CODE, restrictedAt: SEED_CREATED_AT + RESTRICTION_TTL_MS });
    expect(await restrictions().findActive({ now: SEED_CREATED_AT + RESTRICTION_TTL_MS + HOUR_MS })).toEqual({
      errorCode: RESTRICTED_CODE,
    });
    const rows = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM channel_restrictions').first<{ total: number }>();
    expect(rows?.total).toBe(1);
  });

  it('does not restrict another phone number', async () => {
    await restrictions().record({ errorCode: SPAM_RATE_LIMIT_CODE, restrictedAt: SEED_CREATED_AT });
    expect(await restrictions({ phoneNumberId: OTHER_PHONE_NUMBER_ID }).findActive({ now: SEED_CREATED_AT })).toBeNull();
  });

  it('is cleared by deleting the row', async () => {
    await restrictions().record({ errorCode: SPAM_RATE_LIMIT_CODE, restrictedAt: SEED_CREATED_AT });
    await testEnv.CONNECTIONS.prepare('DELETE FROM channel_restrictions WHERE phone_number_id = ?').bind(PHONE_NUMBER_ID).run();
    expect(await restrictions().findActive({ now: SEED_CREATED_AT })).toBeNull();
  });

  it('binds the phone number id and never runs it as SQL', async () => {
    const injected = restrictions({ phoneNumberId: INJECTION_PHONE_NUMBER_ID });
    await injected.record({ errorCode: RESTRICTED_CODE, restrictedAt: SEED_CREATED_AT });
    expect(await injected.findActive({ now: SEED_CREATED_AT })).toEqual({ errorCode: RESTRICTED_CODE });
    expect(await restrictions().findActive({ now: SEED_CREATED_AT })).toBeNull();
  });
});

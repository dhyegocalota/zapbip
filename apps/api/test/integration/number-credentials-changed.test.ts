import { WhatsAppNumberState } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { numberAdminOf } from '../../src/adapters/d1/d1-number-admin';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { applyDirectoryMigration } from '../support/seed';
import { testEnv } from '../support/workers-env';

const REGISTERED_AT = Date.UTC(2026, 10, 7, 12);
const STATE_CHANGED_AT = REGISTERED_AT + 1_000;
const TOKEN_REPLACED_AT = REGISTERED_AT + 2_000;
const registry = numberRegistryOf({ bindings: testEnv });
const admin = numberAdminOf({ bindings: testEnv });

type Timestamps = { credentialsChangedAt: number; updatedAt: number };

async function timestampsOf(input: { numberId: string }): Promise<Timestamps> {
  const row = await testEnv.CONNECTIONS.prepare(
    'SELECT credentials_changed_at AS credentialsChangedAt, updated_at AS updatedAt FROM whatsapp_numbers WHERE id = ?',
  )
    .bind(input.numberId)
    .first<Timestamps>();
  if (row === null) throw new Error('number row is missing');
  return row;
}

beforeEach(async () => {
  await applyDirectoryMigration();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(REGISTERED_AT);
});

afterEach(async () => {
  vi.useRealTimers();
  await reset();
});

describe('the credentials timestamp of a number', () => {
  async function registerNumber(): Promise<string> {
    const { numberId } = await registry.registerNumber({
      phoneNumberId: '1000000000010',
      wabaId: 'waba',
      displayNumber: '+5511900000010',
      label: 'one',
      accessToken: 'token',
      pin: '482915',
    });
    return numberId;
  }

  it('is set when the number is registered', async () => {
    const numberId = await registerNumber();
    expect(await timestampsOf({ numberId })).toEqual({ credentialsChangedAt: REGISTERED_AT, updatedAt: REGISTERED_AT });
  });

  it('does not move on a state change', async () => {
    const numberId = await registerNumber();
    await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET verified_at = ? WHERE id = ?').bind(REGISTERED_AT, numberId).run();
    vi.setSystemTime(STATE_CHANGED_AT);
    await registry.transition({ numberId, to: WhatsAppNumberState.Active });
    expect(await timestampsOf({ numberId })).toEqual({ credentialsChangedAt: REGISTERED_AT, updatedAt: STATE_CHANGED_AT });
  });

  it('moves when the access token is replaced', async () => {
    const numberId = await registerNumber();
    vi.setSystemTime(TOKEN_REPLACED_AT);
    await admin.replaceAccessToken({ numberId, accessToken: 'replacement' });
    expect(await timestampsOf({ numberId })).toEqual({ credentialsChangedAt: TOKEN_REPLACED_AT, updatedAt: TOKEN_REPLACED_AT });
  });
});

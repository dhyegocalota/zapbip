import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { DEVELOPMENT_NUMBER } from '../../src/dev/development-number';
import { developmentNumberStatements } from '../../src/dev/development-number-seed';
import { applyDirectoryMigration, SEED_CREATED_AT } from '../support/seed';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';

const OTHER_NUMBER_ID = 'num_other';
const OTHER_PHONE_NUMBER_ID = '1000000000000009';
const LEGACY_DISPLAY_NUMBER = '5511900000000';

async function registerDevelopmentNumber(): Promise<void> {
  const statements = await developmentNumberStatements({ bindings: testEnv, createdAt: SEED_CREATED_AT });
  await testEnv.CONNECTIONS.batch(statements);
}

async function displayNumberOf(input: { numberId: string }): Promise<string> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT display_number FROM whatsapp_numbers WHERE id = ?')
    .bind(input.numberId)
    .first<{ display_number: string }>();
  if (row === null) throw new Error('number missing');
  return row.display_number;
}

async function countNumbers(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM whatsapp_numbers').first<{ total: number }>();
  if (row === null) throw new Error('count missing');
  return row.total;
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('the development number seed', () => {
  it('registers the development number with credentials the registry opens', async () => {
    await registerDevelopmentNumber();
    const registry = numberRegistryOf({ bindings: testEnv });
    expect(await registry.openTheOnlyNumber()).toMatchObject({
      numberId: DEVELOPMENT_NUMBER.numberId,
      phoneNumberId: DEVELOPMENT_NUMBER.phoneNumberId,
      accessToken: DEVELOPMENT_NUMBER.accessToken,
    });
  });

  it('registers nothing on a second run', async () => {
    await registerDevelopmentNumber();
    await registerDevelopmentNumber();
    expect(await countNumbers()).toBe(1);
  });

  it('adds the plus sign to a development number an older seed stored without it', async () => {
    await seedWhatsAppNumber({ numberId: DEVELOPMENT_NUMBER.numberId, displayNumber: LEGACY_DISPLAY_NUMBER });
    await registerDevelopmentNumber();
    expect(await displayNumberOf({ numberId: DEVELOPMENT_NUMBER.numberId })).toBe(`+${LEGACY_DISPLAY_NUMBER}`);
  });

  it('leaves the display number of another number alone', async () => {
    await seedWhatsAppNumber({ numberId: OTHER_NUMBER_ID, phoneNumberId: OTHER_PHONE_NUMBER_ID, displayNumber: LEGACY_DISPLAY_NUMBER });
    await registerDevelopmentNumber();
    expect(await displayNumberOf({ numberId: OTHER_NUMBER_ID })).toBe(LEGACY_DISPLAY_NUMBER);
  });

  it('leaves a number that was registered before alone', async () => {
    await seedWhatsAppNumber({ numberId: OTHER_NUMBER_ID, phoneNumberId: OTHER_PHONE_NUMBER_ID });
    await registerDevelopmentNumber();
    expect(await countNumbers()).toBe(1);
    expect(await numberRegistryOf({ bindings: testEnv }).openTheOnlyNumber()).toMatchObject({ numberId: OTHER_NUMBER_ID });
  });
});

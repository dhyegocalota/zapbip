import { WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { applyDirectoryMigration } from '../support/seed';
import { seedWhatsAppNumber, TEST_NUMBER_ID } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';

const registry = numberRegistryOf({ bindings: testEnv });

async function stateOf(input: { numberId: string }): Promise<WhatsAppNumberState> {
  const number = await registry.findNumber({ numberId: input.numberId });
  if (number === null) throw new Error('number is missing');
  return number.state;
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('number state transitions in the registry', () => {
  it('updates the state of an allowed transition', async () => {
    await seedWhatsAppNumber({ state: WhatsAppNumberState.Active });
    await registry.transition({ numberId: TEST_NUMBER_ID, to: WhatsAppNumberState.Closed });
    expect(await stateOf({ numberId: TEST_NUMBER_ID })).toBe(WhatsAppNumberState.Closed);
  });

  it('activates a verified pending number', async () => {
    await seedWhatsAppNumber({ state: WhatsAppNumberState.Pending });
    await registry.transition({ numberId: TEST_NUMBER_ID, to: WhatsAppNumberState.Active });
    expect(await stateOf({ numberId: TEST_NUMBER_ID })).toBe(WhatsAppNumberState.Active);
  });

  it('refuses a transition that is not allowed and keeps the state', async () => {
    await seedWhatsAppNumber({ state: WhatsAppNumberState.Disabled });
    await expect(registry.transition({ numberId: TEST_NUMBER_ID, to: WhatsAppNumberState.Active })).rejects.toThrow(
      'transition disabled → active is not allowed',
    );
    expect(await stateOf({ numberId: TEST_NUMBER_ID })).toBe(WhatsAppNumberState.Disabled);
  });

  it('refuses to activate a pending number that was never verified', async () => {
    await seedWhatsAppNumber({ state: WhatsAppNumberState.Pending });
    await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET verified_at = NULL WHERE id = ?').bind(TEST_NUMBER_ID).run();
    await expect(registry.transition({ numberId: TEST_NUMBER_ID, to: WhatsAppNumberState.Active })).rejects.toThrow('is not verified');
    expect(await stateOf({ numberId: TEST_NUMBER_ID })).toBe(WhatsAppNumberState.Pending);
  });

  it('throws for a number that is not registered', async () => {
    await expect(registry.transition({ numberId: 'num_missing', to: WhatsAppNumberState.Closed })).rejects.toThrow('num_missing');
  });
});

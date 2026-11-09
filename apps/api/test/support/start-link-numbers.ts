import { WhatsAppNumberState } from '@zapbip/types';
import { seedWhatsAppNumber } from './whatsapp-numbers';
import { testEnv } from './workers-env';

const UPDATE_CREATED_AT_STATEMENT = 'UPDATE whatsapp_numbers SET created_at = ? WHERE id = ?';
const UPDATE_STATE_STATEMENT = 'UPDATE whatsapp_numbers SET state = ? WHERE id = ?';

export type StartNumberSeed = {
  numberId: string;
  displayNumber: string;
  state: WhatsAppNumberState;
  createdAt: number;
};

export async function seedStartNumber(input: StartNumberSeed): Promise<void> {
  const { numberId, displayNumber, state, createdAt } = input;
  await seedWhatsAppNumber({
    numberId,
    displayNumber,
    state,
    phoneNumberId: `phone-${numberId}`,
    wabaId: `waba-${numberId}`,
  });
  await testEnv.CONNECTIONS.prepare(UPDATE_CREATED_AT_STATEMENT).bind(createdAt, numberId).run();
}

export async function changeStartNumberState(input: { numberId: string; state: WhatsAppNumberState }): Promise<void> {
  await testEnv.CONNECTIONS.prepare(UPDATE_STATE_STATEMENT).bind(input.state, input.numberId).run();
}

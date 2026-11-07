import { AccountState, DAY_MS } from '@zapbip/types';
import { ActivityMetric } from '../../../src/contract/activity-metric';
import { execute } from './operator-database';

const SEALED_PLACEHOLDER = 'walk-sealed-placeholder';
const SEAL_KEY_VERSION = 1;
const NUMBER_STATE_ACTIVE = 'active';
const EPOCH = 0;
const ISO_DAY_LENGTH = 'YYYY-MM-DD'.length;

export const ALPHA_NUMBER = { id: 'walk_num_alpha', label: 'Walk alpha', phoneNumberId: '2000000000001', displayNumber: '+5511900000001' };
export const BRAVO_NUMBER = { id: 'walk_num_bravo', label: 'Walk bravo', phoneNumberId: '2000000000002', displayNumber: '+5511900000002' };
export const EXPECTED_ALL = { accounts: '3', messagesIn: '12', agentsActive: '2' };
export const EXPECTED_ALPHA = { accounts: '1', messagesIn: '5', agentsActive: '1' };

type WalkNumber = typeof ALPHA_NUMBER;

function insertNumber(input: { number: WalkNumber }): string {
  const { id, label, phoneNumberId, displayNumber } = input.number;
  return `INSERT INTO whatsapp_numbers (id, meta_app_ref, phone_number_id, waba_id, display_number, label, sealed_access_token, seal_key_version, state, verified_at, credentials_changed_at, created_at, updated_at)
    VALUES ('${id}', 'walk_meta_app', '${phoneNumberId}', '3${phoneNumberId}', '${displayNumber}', '${label}', '${SEALED_PLACEHOLDER}', ${SEAL_KEY_VERSION}, '${NUMBER_STATE_ACTIVE}', ${EPOCH}, ${EPOCH}, ${EPOCH}, ${EPOCH})`;
}

function insertAccount(input: { id: string; numberId: string; createdAt: number }): string {
  return `INSERT INTO accounts (id, state, created_at, number_id) VALUES ('${input.id}', '${AccountState.Active}', ${input.createdAt}, '${input.numberId}')`;
}

function insertAgent(input: { id: string; accountId: string; createdAt: number }): string {
  return `INSERT INTO connections (id, account_id, agent, secret_digest, client_name, first_call_at, created_at, revoked_at)
    VALUES ('${input.id}', '${input.accountId}', '${input.id}', 'digest-${input.id}', 'walk-client', ${input.createdAt}, ${input.createdAt}, NULL)`;
}

function insertActivity(input: { day: string; accountId: string; numberId: string; metric: ActivityMetric; count: number }): string {
  return `INSERT INTO activity_daily (day, account_id, number_id, metric, count) VALUES ('${input.day}', '${input.accountId}', '${input.numberId}', '${input.metric}', ${input.count})`;
}

export function seedMetrics(): void {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, ISO_DAY_LENGTH);
  const yesterday = new Date(now - DAY_MS).toISOString().slice(0, ISO_DAY_LENGTH);
  execute({
    statements: [
      `INSERT INTO meta_apps (id, meta_app_id, label, sealed_app_secret, seal_key_version, created_at, updated_at)
        VALUES ('walk_meta_app', '900000000001', 'Walk app', '${SEALED_PLACEHOLDER}', ${SEAL_KEY_VERSION}, ${EPOCH}, ${EPOCH})`,
      insertNumber({ number: ALPHA_NUMBER }),
      insertNumber({ number: BRAVO_NUMBER }),
      insertAccount({ id: 'walk_acc_one', numberId: ALPHA_NUMBER.id, createdAt: now }),
      insertAccount({ id: 'walk_acc_two', numberId: BRAVO_NUMBER.id, createdAt: now - DAY_MS }),
      insertAccount({ id: 'walk_acc_three', numberId: BRAVO_NUMBER.id, createdAt: now - DAY_MS }),
      insertAgent({ id: 'walk_agent_one', accountId: 'walk_acc_one', createdAt: now }),
      insertAgent({ id: 'walk_agent_two', accountId: 'walk_acc_two', createdAt: now }),
      insertActivity({ day: today, accountId: 'walk_acc_one', numberId: ALPHA_NUMBER.id, metric: ActivityMetric.MessagesIn, count: 3 }),
      insertActivity({ day: yesterday, accountId: 'walk_acc_one', numberId: ALPHA_NUMBER.id, metric: ActivityMetric.MessagesIn, count: 2 }),
      insertActivity({ day: today, accountId: 'walk_acc_two', numberId: BRAVO_NUMBER.id, metric: ActivityMetric.MessagesIn, count: 7 }),
      insertActivity({ day: today, accountId: 'walk_acc_one', numberId: ALPHA_NUMBER.id, metric: ActivityMetric.MessagesOut, count: 4 }),
      insertActivity({ day: today, accountId: 'walk_acc_one', numberId: ALPHA_NUMBER.id, metric: ActivityMetric.WakesWoken, count: 3 }),
      insertActivity({ day: today, accountId: 'walk_acc_one', numberId: ALPHA_NUMBER.id, metric: ActivityMetric.WakesUnreached, count: 1 }),
    ],
  });
}

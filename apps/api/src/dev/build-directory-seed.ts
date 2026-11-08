import { AGENT_NAME_PATTERN, InboxError } from '@zapbip/core';
import { AccountState, DEFAULT_LOCALE, InboxErrorCode } from '@zapbip/types';
import { generateConnectionSecret } from '../adapters/platform/connection-secret';
import { hashConnectionSecret } from '../adapters/platform/hash';
import { OWNER_PHONE_PATTERN } from '../contract/constants';

const FIRST_NUMBER_SUBQUERY = '(SELECT id FROM whatsapp_numbers ORDER BY created_at, id LIMIT 1)';

export type DirectorySeed = {
  accountId: string;
  connections: { agent: string; secret: string; secretDigest: string }[];
  statements: string[];
};

function invalidInput(input: { message: string }): InboxError {
  return new InboxError({ code: InboxErrorCode.InvalidInput, message: input.message });
}

function literal(input: { value: string | number }): string {
  if (typeof input.value === 'number') return String(input.value);
  return "'" + input.value.replaceAll("'", "''") + "'";
}

function insertStatement(input: { table: string; columns: string[]; values: (string | number)[] }): string {
  return (
    'INSERT INTO ' +
    input.table +
    ' (' +
    input.columns.join(', ') +
    ') VALUES (' +
    input.values.map((value) => literal({ value })).join(', ') +
    ')'
  );
}

function assertSeedInput(input: { phone: string; agents: string[] }): void {
  if (!OWNER_PHONE_PATTERN.test(input.phone)) throw invalidInput({ message: 'phone: must be 8 to 15 digits' });
  if (input.agents.length === 0) throw invalidInput({ message: 'agents: at least one agent is required' });
  if (!input.agents.every((agent) => AGENT_NAME_PATTERN.test(agent))) throw invalidInput({ message: 'agents: invalid agent name' });
  if (new Set(input.agents).size !== input.agents.length) throw invalidInput({ message: 'agents: names must be unique' });
}

export function findOwnerStatement(input: { phone: string }): string {
  if (!OWNER_PHONE_PATTERN.test(input.phone)) throw invalidInput({ message: 'phone: must be 8 to 15 digits' });
  return 'SELECT COUNT(*) AS total FROM owner_identities WHERE wa_id = ' + literal({ value: input.phone });
}

export function assertOwnerAbsent(input: { existingCount: number }): void {
  if (input.existingCount > 0) throw invalidInput({ message: 'phone: already seeded' });
}

export async function buildDirectorySeed(input: { phone: string; agents: string[]; createdAt: number }): Promise<DirectorySeed> {
  assertSeedInput(input);
  const accountId = 'acc_' + crypto.randomUUID().replaceAll('-', '');
  const connections = await Promise.all(
    input.agents.map(async (agent) => {
      const secret = generateConnectionSecret();
      return { agent, secret, secretDigest: await hashConnectionSecret({ secret }) };
    }),
  );
  const connectionStatements = connections.map(({ agent, secretDigest }) =>
    insertStatement({
      table: 'connections',
      columns: ['id', 'account_id', 'agent', 'secret_digest', 'created_at'],
      values: ['con_' + crypto.randomUUID().replaceAll('-', ''), accountId, agent, secretDigest, input.createdAt],
    }),
  );
  return {
    accountId,
    connections,
    statements: [
      'INSERT INTO accounts (id, state, created_at, number_id) VALUES (' +
        [literal({ value: accountId }), literal({ value: AccountState.Active }), input.createdAt].join(', ') +
        ', ' +
        FIRST_NUMBER_SUBQUERY +
        ')',
      'INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES (' +
        [literal({ value: input.phone }), literal({ value: accountId }), 'NULL', literal({ value: DEFAULT_LOCALE }), input.createdAt].join(
          ', ',
        ) +
        ')',
      ...connectionStatements,
    ],
  };
}

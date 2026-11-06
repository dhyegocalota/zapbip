import { AGENT_NAME_PATTERN, InboxError } from '@zapbip/core';
import { AccountState, DEFAULT_LOCALE, InboxErrorCode } from '@zapbip/types';
import { generateConnectionSecret } from '../src/adapters/platform/connection-secret';
import { hashConnectionSecret } from '../src/adapters/platform/hash';
import { OWNER_PHONE_PATTERN } from '../src/contract/constants';

export type DirectorySeed = { connections: { agent: string; secret: string }[]; statements: string[] };

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
  const connections = input.agents.map((agent) => ({ agent, secret: generateConnectionSecret() }));
  const connectionStatements = await Promise.all(
    connections.map(async ({ agent, secret }) =>
      insertStatement({
        table: 'connections',
        columns: ['id', 'account_id', 'agent', 'secret_digest', 'created_at'],
        values: [
          'con_' + crypto.randomUUID().replaceAll('-', ''),
          accountId,
          agent,
          await hashConnectionSecret({ secret }),
          input.createdAt,
        ],
      }),
    ),
  );
  return {
    connections,
    statements: [
      insertStatement({
        table: 'accounts',
        columns: ['id', 'state', 'created_at'],
        values: [accountId, AccountState.Active, input.createdAt],
      }),
      'INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES (' +
        [literal({ value: input.phone }), literal({ value: accountId }), 'NULL', literal({ value: DEFAULT_LOCALE }), input.createdAt].join(
          ', ',
        ) +
        ')',
      ...connectionStatements,
    ],
  };
}

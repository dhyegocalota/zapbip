import type { FirstMessageClaim } from '@zapbip/core';

const KEEP_FIRST_MESSAGE_STATEMENT =
  'INSERT INTO account_facts (id, first_message_id) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET first_message_id = COALESCE(first_message_id, excluded.first_message_id)';
const READ_FIRST_MESSAGE_STATEMENT = 'SELECT first_message_id FROM account_facts WHERE id = 1';

export function createSqliteFirstMessageClaim(input: { storage: DurableObjectStorage }): FirstMessageClaim {
  return {
    claim: async ({ channelMessageId }) => {
      input.storage.sql.exec(KEEP_FIRST_MESSAGE_STATEMENT, channelMessageId);
      const { first_message_id: firstMessageId } = input.storage.sql.exec<{ first_message_id: string }>(READ_FIRST_MESSAGE_STATEMENT).one();
      return firstMessageId === channelMessageId;
    },
  };
}

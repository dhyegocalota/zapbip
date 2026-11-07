import { WakeMode } from '@zapbip/types';
import { lastRequestedAtKeyOf } from '../adapters/sqlite/sqlite-wake-repository';
import { keyDigestKeyOf } from './agent-key-digest';

const CLEAR_WAKE_STATEMENT = 'DELETE FROM agent_wake WHERE agent = ?';
const CLEAR_WAKE_JOBS_STATEMENT = 'DELETE FROM wake_jobs WHERE agent = ?';
const RELEASE_STANDBY_STATEMENT =
  'UPDATE agent_wake SET mode = ?, standby_agent = NULL, updated_at = ? WHERE mode = ? AND standby_agent = ?';
const REOPEN_HANDOFFS_STATEMENT = `UPDATE inbox_messages SET read_at = NULL, handed_to = NULL
  WHERE handed_to = ?1 AND EXISTS (
    SELECT 1 FROM inbox_messages AS copy WHERE copy.agent = ?1 AND copy.origin_message_id = inbox_messages.id AND copy.read_at IS NULL
  )`;
const DROP_STANDBY_COPIES_STATEMENT = 'DELETE FROM inbox_messages WHERE agent = ? AND origin_message_id IS NOT NULL AND read_at IS NULL';
const CLOSE_QUESTIONS_STATEMENT = 'DELETE FROM questions WHERE agent = ? AND answer IS NULL';
const MARK_REVOKED_STATEMENT =
  'INSERT INTO revoked_agents (agent, revoked_at) VALUES (?, ?) ON CONFLICT (agent) DO UPDATE SET revoked_at = excluded.revoked_at';
const SELECT_REVOKED_STATEMENT = 'SELECT agent FROM revoked_agents WHERE agent = ?';
const FORGET_REVOKED_STATEMENT = 'DELETE FROM revoked_agents WHERE agent = ?';
const FORGET_MESSAGES_STATEMENT = 'DELETE FROM inbox_messages WHERE agent = ?';
const FORGET_HANDOFFS_STATEMENT = 'UPDATE inbox_messages SET handed_to = NULL WHERE handed_to = ?';
const FORGET_QUESTIONS_STATEMENT = 'DELETE FROM questions WHERE agent = ?';
const FORGET_AGENT_STATEMENT = 'DELETE FROM agents WHERE agent = ?';

export function revokeAgentState(input: { storage: DurableObjectStorage; agent: string; revokedAt: number }): void {
  input.storage.transactionSync(() => {
    input.storage.sql.exec(REOPEN_HANDOFFS_STATEMENT, input.agent);
    input.storage.sql.exec(DROP_STANDBY_COPIES_STATEMENT, input.agent);
    input.storage.sql.exec(RELEASE_STANDBY_STATEMENT, WakeMode.None, input.revokedAt, WakeMode.Standby, input.agent);
    input.storage.sql.exec(CLEAR_WAKE_STATEMENT, input.agent);
    input.storage.sql.exec(CLEAR_WAKE_JOBS_STATEMENT, input.agent);
    input.storage.sql.exec(CLOSE_QUESTIONS_STATEMENT, input.agent);
    input.storage.sql.exec(MARK_REVOKED_STATEMENT, input.agent, input.revokedAt);
    input.storage.kv.delete(lastRequestedAtKeyOf({ agent: input.agent }));
    input.storage.kv.delete(keyDigestKeyOf({ agent: input.agent }));
  });
}

export function reviveAgentName(input: { storage: DurableObjectStorage; agent: string; revivedAt: number }): void {
  input.storage.transactionSync(() => {
    input.storage.sql.exec(RELEASE_STANDBY_STATEMENT, WakeMode.None, input.revivedAt, WakeMode.Standby, input.agent);
    input.storage.sql.exec(FORGET_HANDOFFS_STATEMENT, input.agent);
    input.storage.sql.exec(CLEAR_WAKE_STATEMENT, input.agent);
    input.storage.sql.exec(CLEAR_WAKE_JOBS_STATEMENT, input.agent);
    input.storage.kv.delete(lastRequestedAtKeyOf({ agent: input.agent }));
    input.storage.sql.exec(FORGET_REVOKED_STATEMENT, input.agent);
    input.storage.sql.exec(FORGET_MESSAGES_STATEMENT, input.agent);
    input.storage.sql.exec(FORGET_QUESTIONS_STATEMENT, input.agent);
    input.storage.sql.exec(FORGET_AGENT_STATEMENT, input.agent);
  });
}

export function isAgentRevoked(input: { storage: DurableObjectStorage; agent: string }): boolean {
  return input.storage.sql.exec(SELECT_REVOKED_STATEMENT, input.agent).toArray().length > 0;
}

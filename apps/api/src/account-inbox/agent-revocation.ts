const CLEAR_WAKE_STATEMENT = 'DELETE FROM agent_wake WHERE agent = ?';
const CLOSE_QUESTIONS_STATEMENT = 'DELETE FROM questions WHERE agent = ? AND answer IS NULL';
const MARK_REVOKED_STATEMENT =
  'INSERT INTO revoked_agents (agent, revoked_at) VALUES (?, ?) ON CONFLICT (agent) DO UPDATE SET revoked_at = excluded.revoked_at';
const FORGET_REVOKED_STATEMENT = 'DELETE FROM revoked_agents WHERE agent = ?';
const FORGET_MESSAGES_STATEMENT = 'DELETE FROM inbox_messages WHERE agent = ?';
const FORGET_QUESTIONS_STATEMENT = 'DELETE FROM questions WHERE agent = ?';
const FORGET_AGENT_STATEMENT = 'DELETE FROM agents WHERE agent = ?';

export function revokeAgentState(input: { storage: DurableObjectStorage; agent: string; revokedAt: number }): void {
  input.storage.transactionSync(() => {
    input.storage.sql.exec(CLEAR_WAKE_STATEMENT, input.agent);
    input.storage.sql.exec(CLOSE_QUESTIONS_STATEMENT, input.agent);
    input.storage.sql.exec(MARK_REVOKED_STATEMENT, input.agent, input.revokedAt);
  });
}

export function reviveAgentName(input: { storage: DurableObjectStorage; agent: string }): void {
  input.storage.transactionSync(() => {
    input.storage.sql.exec(FORGET_REVOKED_STATEMENT, input.agent);
    input.storage.sql.exec(FORGET_MESSAGES_STATEMENT, input.agent);
    input.storage.sql.exec(FORGET_QUESTIONS_STATEMENT, input.agent);
    input.storage.sql.exec(FORGET_AGENT_STATEMENT, input.agent);
  });
}

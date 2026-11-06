const CLEAR_WAKE_STATEMENT = 'DELETE FROM agent_wake WHERE agent = ?';
const MARK_REVOKED_STATEMENT =
  'INSERT INTO revoked_agents (agent, revoked_at) VALUES (?, ?) ON CONFLICT (agent) DO UPDATE SET revoked_at = excluded.revoked_at';

export function revokeAgentState(input: { storage: DurableObjectStorage; agent: string; revokedAt: number }): void {
  input.storage.transactionSync(() => {
    input.storage.sql.exec(CLEAR_WAKE_STATEMENT, input.agent);
    input.storage.sql.exec(MARK_REVOKED_STATEMENT, input.agent, input.revokedAt);
  });
}

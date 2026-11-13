import { WaitlistSource } from '@zapbip/types';
import { AGENT_CAP_WINDOW_MS, AGENT_HOURLY_ROW_CAP } from './site-constants';

const COUNT_STATEMENT = 'SELECT COUNT(*) AS total FROM landing_waitlist WHERE source = ? AND created_at > ?';

export async function isAgentRowCapReached(input: { database: D1Database; now: number }): Promise<boolean> {
  const row = await input.database
    .prepare(COUNT_STATEMENT)
    .bind(WaitlistSource.Agent, input.now - AGENT_CAP_WINDOW_MS)
    .first<{ total: number }>();
  if (row === null) throw new Error('the agent row count returned no row');
  return row.total >= AGENT_HOURLY_ROW_CAP;
}

import { DAY_MS } from '@zapbip/types';
import { utcDay } from '../../account-inbox/usage-meter';
import { RESTRICTION_TTL_MS } from '../../adapters/whatsapp/whatsapp-constants';
import { periodDays, type MetricsFilter } from './metrics-filter';
import type { AgentTotals, MetricsReport } from './metrics-report';

enum MetricsQuery {
  Numbers,
  AccountsByState,
  AccountsPerNumber,
  NewAccounts,
  AgentTotals,
  AgentsByClient,
  AgentsCreated,
  AgentsRevoked,
  Activity,
  Budget,
  BlockedPhones,
  Restricted,
}

const NUMBER_FILTER = '(?1 IS NULL OR a.number_id = ?1)';
const CREATED_DAY = "strftime('%Y-%m-%d', c.created_at / 1000, 'unixepoch')";
const REVOKED_DAY = "strftime('%Y-%m-%d', c.revoked_at / 1000, 'unixepoch')";
const ACCOUNT_DAY = "strftime('%Y-%m-%d', a.created_at / 1000, 'unixepoch')";
const AGENT_SCOPE = 'FROM connections c JOIN accounts a ON a.id = c.account_id WHERE ' + NUMBER_FILTER;

const NUMBERS_STATEMENT = 'SELECT id AS numberId, label FROM whatsapp_numbers ORDER BY label';
const ACCOUNTS_BY_STATE_STATEMENT =
  'SELECT a.state AS state, COUNT(*) AS total FROM accounts a WHERE ' + NUMBER_FILTER + ' GROUP BY a.state';
const ACCOUNTS_PER_NUMBER_STATEMENT =
  'SELECT n.id AS numberId, n.label AS label, COUNT(a.id) AS total FROM accounts a JOIN whatsapp_numbers n ON n.id = a.number_id WHERE ' +
  NUMBER_FILTER +
  ' GROUP BY n.id, n.label ORDER BY n.label';
const NEW_ACCOUNTS_STATEMENT =
  'SELECT ' + ACCOUNT_DAY + ' AS day, COUNT(*) AS total FROM accounts a WHERE a.created_at >= ?2 AND ' + NUMBER_FILTER + ' GROUP BY day';
const AGENT_TOTALS_STATEMENT =
  'SELECT COUNT(*) AS active, COALESCE(SUM(c.first_call_at IS NOT NULL), 0) AS connected ' + AGENT_SCOPE + ' AND c.revoked_at IS NULL';
const AGENTS_BY_CLIENT_STATEMENT =
  'SELECT c.client_name AS clientName, COUNT(*) AS total ' +
  AGENT_SCOPE +
  ' AND c.revoked_at IS NULL GROUP BY c.client_name ORDER BY total DESC';
const AGENTS_CREATED_STATEMENT =
  'SELECT ' + CREATED_DAY + ' AS day, COUNT(*) AS total ' + AGENT_SCOPE + ' AND c.created_at >= ?2 GROUP BY day';
const AGENTS_REVOKED_STATEMENT =
  'SELECT ' + REVOKED_DAY + ' AS day, COUNT(*) AS total ' + AGENT_SCOPE + ' AND c.revoked_at >= ?2 GROUP BY day';
const ACTIVITY_STATEMENT = `SELECT day, metric, SUM(count) AS total FROM activity_daily
  WHERE day >= ?2 AND (?1 IS NULL OR number_id = ?1) GROUP BY day, metric`;
const BUDGET_STATEMENT = 'SELECT day, SUM(gigabyte_seconds) AS total FROM usage_daily WHERE day >= ?1 GROUP BY day';
const BLOCKED_PHONES_STATEMENT = 'SELECT COUNT(*) AS total FROM blocked_phones';
const RESTRICTED_STATEMENT = `SELECT n.id AS numberId, n.label AS label, r.restricted_at AS restrictedAt
  FROM channel_restrictions r JOIN whatsapp_numbers n ON n.phone_number_id = r.phone_number_id
  WHERE r.restricted_at > ?2 AND (?1 IS NULL OR n.id = ?1) ORDER BY n.label`;

function resultRows<Row>(input: { results: D1Result[]; query: MetricsQuery }): Row[] {
  const result = input.results[input.query];
  if (result === undefined) throw new Error(`the metrics batch returned no result for ${MetricsQuery[input.query]}`);
  return result.results as Row[];
}

function singleRow<Row>(input: { results: D1Result[]; query: MetricsQuery }): Row {
  const [row] = resultRows<Row>(input);
  if (row === undefined) throw new Error(`the metrics query ${MetricsQuery[input.query]} returned no row`);
  return row;
}

export async function readMetrics(input: { database: D1Database; filter: MetricsFilter; now: number }): Promise<MetricsReport> {
  const { database, filter, now } = input;
  const { numberId } = filter;
  const sinceDay = utcDay({ now: now - (periodDays({ period: filter.period }) - 1) * DAY_MS });
  const sinceAt = Date.parse(sinceDay);
  const restrictedSince = now - RESTRICTION_TTL_MS;
  const results = await database.batch([
    database.prepare(NUMBERS_STATEMENT),
    database.prepare(ACCOUNTS_BY_STATE_STATEMENT).bind(numberId),
    database.prepare(ACCOUNTS_PER_NUMBER_STATEMENT).bind(numberId),
    database.prepare(NEW_ACCOUNTS_STATEMENT).bind(numberId, sinceAt),
    database.prepare(AGENT_TOTALS_STATEMENT).bind(numberId),
    database.prepare(AGENTS_BY_CLIENT_STATEMENT).bind(numberId),
    database.prepare(AGENTS_CREATED_STATEMENT).bind(numberId, sinceAt),
    database.prepare(AGENTS_REVOKED_STATEMENT).bind(numberId, sinceAt),
    database.prepare(ACTIVITY_STATEMENT).bind(numberId, sinceDay),
    database.prepare(BUDGET_STATEMENT).bind(sinceDay),
    database.prepare(BLOCKED_PHONES_STATEMENT),
    database.prepare(RESTRICTED_STATEMENT).bind(numberId, restrictedSince),
  ]);
  return {
    numbers: resultRows({ results, query: MetricsQuery.Numbers }),
    accountsByState: resultRows({ results, query: MetricsQuery.AccountsByState }),
    accountsPerNumber: resultRows({ results, query: MetricsQuery.AccountsPerNumber }),
    newAccounts: resultRows({ results, query: MetricsQuery.NewAccounts }),
    agents: singleRow<AgentTotals>({ results, query: MetricsQuery.AgentTotals }),
    agentsByClient: resultRows({ results, query: MetricsQuery.AgentsByClient }),
    agentsCreated: resultRows({ results, query: MetricsQuery.AgentsCreated }),
    agentsRevoked: resultRows({ results, query: MetricsQuery.AgentsRevoked }),
    activity: resultRows({ results, query: MetricsQuery.Activity }),
    budgetDays: resultRows({ results, query: MetricsQuery.Budget }),
    blockedPhones: singleRow<{ total: number }>({ results, query: MetricsQuery.BlockedPhones }).total,
    restricted: resultRows({ results, query: MetricsQuery.Restricted }),
  };
}

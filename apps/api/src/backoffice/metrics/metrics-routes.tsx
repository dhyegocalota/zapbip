import { Hono } from 'hono';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';
import { signedInPageContext } from '../page-context';
import { NUMBER_QUERY, parseMetricsFilter, PERIOD_QUERY } from './metrics-filter';
import { MetricsPage } from './metrics-page';
import { readMetrics } from './metrics-queries';

export const metricsRoutes = new Hono<BackofficeEnv>();

metricsRoutes.get(BackofficePath.Metrics, async (context) => {
  const filter = parseMetricsFilter({ numberId: context.req.query(NUMBER_QUERY), period: context.req.query(PERIOD_QUERY) });
  const now = Date.now();
  const report = await readMetrics({ database: context.env.CONNECTIONS, filter, now });
  return context.html(<MetricsPage page={await signedInPageContext({ context })} filter={filter} report={report} now={now} />);
});

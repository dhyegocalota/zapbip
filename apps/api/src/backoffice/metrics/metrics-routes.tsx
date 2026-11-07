import { Hono, type Context } from 'hono';
import { SEE_OTHER_STATUS } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficeNotice } from '../backoffice-notice';
import { withNotice } from '../numbers/number-paths';
import { BackofficePath } from '../backoffice-paths';
import { signedInPageContext } from '../page-context';
import { isKnownMetricsNumber, NUMBER_QUERY, parseMetricsFilter, PERIOD_QUERY } from './metrics-filter';
import { MetricsPage } from './metrics-page';
import { readMetrics } from './metrics-queries';

export const metricsRoutes = new Hono<BackofficeEnv>();

function noticeRedirect(input: { context: Context<BackofficeEnv>; notice: BackofficeNotice }): Response {
  return input.context.redirect(withNotice({ path: BackofficePath.Metrics, notice: input.notice }), SEE_OTHER_STATUS);
}

metricsRoutes.get(BackofficePath.Metrics, async (context) => {
  const parsed = parseMetricsFilter({ numberId: context.req.query(NUMBER_QUERY), period: context.req.query(PERIOD_QUERY) });
  if ('notice' in parsed) return noticeRedirect({ context, notice: parsed.notice });
  const now = Date.now();
  const report = await readMetrics({ database: context.env.CONNECTIONS, filter: parsed.filter, now });
  if (!isKnownMetricsNumber({ filter: parsed.filter, numbers: report.numbers }))
    return noticeRedirect({ context, notice: BackofficeNotice.MetricsNumberNotFound });
  return context.html(<MetricsPage page={await signedInPageContext({ context })} filter={parsed.filter} report={report} now={now} />);
});

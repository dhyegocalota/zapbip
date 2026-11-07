import { AccountState } from '@zapbip/types';
import { ActivityMetric } from '../../contract/activity-metric';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';
import { BudgetBar } from './budget-bar';
import { BarChart, BarPattern, type ChartSeries } from './bar-chart';
import { FigureNumber } from './figure-number';
import { FilterForm } from './filter-form';
import { SummaryTable } from './summary-table';
import { keyedCell, MetricCell, NOT_REPORTED_CLIENT_KEY } from './metric-cell';
import { windowDays, type MetricsFilter } from './metrics-filter';
import type { MetricsReport } from './metrics-report';
import { activitySeries, dailySeries, sumOf, wakeDays, wakeSuccessPercent } from './metrics-series';
import { Layout } from '../layout';
import type { PageContext } from '../page-context';
import { formatTimestamp } from '../format-timestamp';
import { utcDay } from '../../account-inbox/usage-meter';

const WAKE_DECIMALS = 1;
const ACCOUNT_STATE_LABELS: Record<AccountState, BackofficeCopyKey> = {
  [AccountState.Waitlisted]: BackofficeCopyKey.MetricsAccountStateWaitlisted,
  [AccountState.Active]: BackofficeCopyKey.MetricsAccountStateActive,
  [AccountState.Suspended]: BackofficeCopyKey.MetricsAccountStateSuspended,
  [AccountState.Deleting]: BackofficeCopyKey.MetricsAccountStateDeleting,
};

export function MetricsPage(props: { page: PageContext; filter: MetricsFilter; report: MetricsReport; now: number }) {
  const { page, filter, report, now } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const days = windowDays({ now, period: filter.period });
  const today = utcDay({ now });
  const liveLabel = translate(BackofficeCopyKey.MetricsFreshnessLive);
  const noData = translate(BackofficeCopyKey.MetricsNoData);
  const hourlyLabel = translate(BackofficeCopyKey.MetricsFreshnessHourly);
  const totalOf = (metric: ActivityMetric): number => sumOf({ values: activitySeries({ days, rows: report.activity, metric }) });
  const activityOf = (input: { metric: ActivityMetric; label: string; cell: MetricCell; pattern: BarPattern }): ChartSeries => {
    const values = activitySeries({ days, rows: report.activity, metric: input.metric });
    return { label: input.label, cell: input.cell, values, valueTexts: values.map(String), pattern: input.pattern };
  };
  const countsOf = (input: { rows: MetricsReport['newAccounts']; label: string; cell: MetricCell; pattern: BarPattern }): ChartSeries => {
    const values = dailySeries({ days, rows: input.rows });
    return { label: input.label, cell: input.cell, values, valueTexts: values.map(String), pattern: input.pattern };
  };
  const wakeValues = wakeDays({ days, rows: report.activity });
  const wakePercents = wakeValues.map((day) => wakeSuccessPercent(day));
  const overallWake = wakeSuccessPercent({
    woken: totalOf(ActivityMetric.WakesWoken),
    unreached: totalOf(ActivityMetric.WakesUnreached),
  });
  const noWakes = translate(BackofficeCopyKey.MetricsWakeNoWakes);
  const percentText = (percent: number | null): string => (percent === null ? noWakes : `${percent.toFixed(WAKE_DECIMALS)}%`);
  const wakeSeries: ChartSeries = {
    label: translate(BackofficeCopyKey.MetricsWakeTitle),
    cell: MetricCell.WakeSuccess,
    values: wakePercents.map((percent) => (percent === null ? 0 : percent)),
    valueTexts: wakePercents.map(percentText),
    pattern: BarPattern.Solid,
  };
  const accountTotal = sumOf({ values: report.accountsByState.map((entry) => entry.total) });
  const chartProps = { locale, days, today };
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.MetricsTitle)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Metrics}
      notice={page.notice}
    >
      <h1>{translate(BackofficeCopyKey.MetricsTitle)}</h1>
      <FilterForm locale={locale} filter={filter} numbers={report.numbers} />
      <div class="figure-grid">
        <FigureNumber
          id="figure-accounts"
          label={translate(BackofficeCopyKey.MetricsAccountsTitle)}
          value={String(accountTotal)}
          cell={MetricCell.Accounts}
          freshness={liveLabel}
        />
        <FigureNumber
          id="figure-agents-active"
          label={translate(BackofficeCopyKey.MetricsAgentsActive)}
          value={String(report.agents.active)}
          cell={MetricCell.AgentsActive}
          freshness={liveLabel}
        />
        <FigureNumber
          id="figure-agents-connected"
          label={translate(BackofficeCopyKey.MetricsAgentsConnected)}
          value={String(report.agents.connected)}
          cell={MetricCell.AgentsConnected}
          freshness={liveLabel}
        />
        <FigureNumber
          id="figure-blocked-phones"
          label={translate(BackofficeCopyKey.MetricsBlockedPhones)}
          value={String(report.blockedPhones)}
          cell={MetricCell.BlockedPhones}
          freshness={liveLabel}
        />
      </div>
      <section class="card" aria-labelledby="metrics-accounts-title">
        <h2 id="metrics-accounts-title">{translate(BackofficeCopyKey.MetricsAccountsTitle)}</h2>
        <p class="figure-freshness">{liveLabel}</p>
        <h3>{translate(BackofficeCopyKey.MetricsAccountsByState)}</h3>
        <SummaryTable
          caption={translate(BackofficeCopyKey.MetricsAccountsByState)}
          emptyText={noData}
          rows={report.accountsByState.map((entry) => ({
            label: translate(ACCOUNT_STATE_LABELS[entry.state]),
            value: String(entry.total),
            cell: keyedCell({ cell: MetricCell.AccountState, key: entry.state }),
          }))}
        />
        <h3>{translate(BackofficeCopyKey.MetricsAccountsPerNumber)}</h3>
        <SummaryTable
          caption={translate(BackofficeCopyKey.MetricsAccountsPerNumber)}
          emptyText={noData}
          rows={report.accountsPerNumber.map((entry) => ({
            label: entry.label,
            value: String(entry.total),
            cell: keyedCell({ cell: MetricCell.NumberAccounts, key: entry.numberId }),
          }))}
        />
        <h3>{translate(BackofficeCopyKey.MetricsNewAccountsPerDay)}</h3>
        <BarChart
          {...chartProps}
          id="chart-new-accounts"
          metricLabel={translate(BackofficeCopyKey.MetricsNewAccountsPerDay)}
          series={[
            countsOf({
              rows: report.newAccounts,
              label: translate(BackofficeCopyKey.ColumnCount),
              cell: MetricCell.NewAccounts,
              pattern: BarPattern.Solid,
            }),
          ]}
          totalText={String(sumOf({ values: report.newAccounts.map((entry) => entry.total) }))}
          isHourly={false}
        />
      </section>
      <section class="card" aria-labelledby="metrics-agents-title">
        <h2 id="metrics-agents-title">{translate(BackofficeCopyKey.MetricsAgentsTitle)}</h2>
        <p class="figure-freshness">{liveLabel}</p>
        <h3>{translate(BackofficeCopyKey.MetricsAgentsByClient)}</h3>
        <SummaryTable
          caption={translate(BackofficeCopyKey.MetricsAgentsByClient)}
          emptyText={noData}
          rows={report.agentsByClient.map((entry) => ({
            label: entry.clientName === null ? translate(BackofficeCopyKey.MetricsAgentsNotReported) : entry.clientName,
            value: String(entry.total),
            cell: keyedCell({ cell: MetricCell.AgentClient, key: entry.clientName === null ? NOT_REPORTED_CLIENT_KEY : entry.clientName }),
          }))}
        />
        <h3>{translate(BackofficeCopyKey.MetricsAgentsCreatedRevoked)}</h3>
        <BarChart
          {...chartProps}
          id="chart-agents"
          metricLabel={translate(BackofficeCopyKey.MetricsAgentsCreatedRevoked)}
          series={[
            countsOf({
              rows: report.agentsCreated,
              label: translate(BackofficeCopyKey.ColumnCreated),
              cell: MetricCell.AgentsCreated,
              pattern: BarPattern.Solid,
            }),
            countsOf({
              rows: report.agentsRevoked,
              label: translate(BackofficeCopyKey.ColumnRevoked),
              cell: MetricCell.AgentsRevoked,
              pattern: BarPattern.Hatched,
            }),
          ]}
          totalText={String(sumOf({ values: [...report.agentsCreated, ...report.agentsRevoked].map((entry) => entry.total) }))}
          isHourly={false}
        />
      </section>
      <section class="card" aria-labelledby="metrics-messages-title">
        <h2 id="metrics-messages-title">{translate(BackofficeCopyKey.MetricsMessagesTitle)}</h2>
        <p class="figure-freshness">{hourlyLabel}</p>
        <div class="figure-grid">
          <FigureNumber
            id="figure-messages-in"
            label={translate(BackofficeCopyKey.MetricsMessagesIn)}
            value={String(totalOf(ActivityMetric.MessagesIn))}
            cell={MetricCell.MessagesIn}
            freshness={hourlyLabel}
          />
          <FigureNumber
            id="figure-messages-out"
            label={translate(BackofficeCopyKey.MetricsMessagesOut)}
            value={String(totalOf(ActivityMetric.MessagesOut))}
            cell={MetricCell.MessagesOut}
            freshness={hourlyLabel}
          />
        </div>
        <BarChart
          {...chartProps}
          id="chart-messages"
          metricLabel={translate(BackofficeCopyKey.MetricsMessagesTitle)}
          series={[
            activityOf({
              metric: ActivityMetric.MessagesIn,
              label: translate(BackofficeCopyKey.MetricsMessagesIn),
              cell: MetricCell.MessagesIn,
              pattern: BarPattern.Solid,
            }),
            activityOf({
              metric: ActivityMetric.MessagesOut,
              label: translate(BackofficeCopyKey.MetricsMessagesOut),
              cell: MetricCell.MessagesOut,
              pattern: BarPattern.Hatched,
            }),
          ]}
          totalText={String(totalOf(ActivityMetric.MessagesIn) + totalOf(ActivityMetric.MessagesOut))}
          isHourly
        />
      </section>
      <section class="card" aria-labelledby="metrics-templates-title">
        <h2 id="metrics-templates-title">{translate(BackofficeCopyKey.MetricsTemplatesTitle)}</h2>
        <p class="figure-freshness">{hourlyLabel}</p>
        <div class="figure-grid">
          <FigureNumber
            id="figure-templates-notice"
            label={translate(BackofficeCopyKey.MetricsTemplatesNotice)}
            value={String(totalOf(ActivityMetric.TemplatesSentNotice))}
            cell={MetricCell.TemplatesNotice}
            freshness={hourlyLabel}
          />
          <FigureNumber
            id="figure-templates-question"
            label={translate(BackofficeCopyKey.MetricsTemplatesQuestion)}
            value={String(totalOf(ActivityMetric.TemplatesSentQuestion))}
            cell={MetricCell.TemplatesQuestion}
            freshness={hourlyLabel}
          />
        </div>
        <BarChart
          {...chartProps}
          id="chart-templates"
          metricLabel={translate(BackofficeCopyKey.MetricsTemplatesTitle)}
          series={[
            activityOf({
              metric: ActivityMetric.TemplatesSentNotice,
              label: translate(BackofficeCopyKey.MetricsTemplatesNotice),
              cell: MetricCell.TemplatesNotice,
              pattern: BarPattern.Solid,
            }),
            activityOf({
              metric: ActivityMetric.TemplatesSentQuestion,
              label: translate(BackofficeCopyKey.MetricsTemplatesQuestion),
              cell: MetricCell.TemplatesQuestion,
              pattern: BarPattern.Hatched,
            }),
          ]}
          totalText={String(totalOf(ActivityMetric.TemplatesSentNotice) + totalOf(ActivityMetric.TemplatesSentQuestion))}
          isHourly
        />
      </section>
      <section class="card" aria-labelledby="metrics-failures-title">
        <h2 id="metrics-failures-title">{translate(BackofficeCopyKey.MetricsFailuresTitle)}</h2>
        <p class="figure-freshness">{hourlyLabel}</p>
        <FigureNumber
          id="figure-sends-failed"
          label={translate(BackofficeCopyKey.MetricsFailuresTitle)}
          value={String(totalOf(ActivityMetric.SendsFailed))}
          cell={MetricCell.SendsFailed}
          freshness={hourlyLabel}
        />
        <BarChart
          {...chartProps}
          id="chart-failures"
          metricLabel={translate(BackofficeCopyKey.MetricsFailuresTitle)}
          series={[
            activityOf({
              metric: ActivityMetric.SendsFailed,
              label: translate(BackofficeCopyKey.ColumnCount),
              cell: MetricCell.SendsFailed,
              pattern: BarPattern.Solid,
            }),
          ]}
          totalText={String(totalOf(ActivityMetric.SendsFailed))}
          isHourly
        />
      </section>
      <section class="card" aria-labelledby="metrics-wake-title">
        <h2 id="metrics-wake-title">{translate(BackofficeCopyKey.MetricsWakeTitle)}</h2>
        <p class="figure-freshness">{hourlyLabel}</p>
        <FigureNumber
          id="figure-wake-success"
          label={translate(BackofficeCopyKey.MetricsWakeTitle)}
          value={percentText(overallWake)}
          cell={MetricCell.WakeSuccess}
          freshness={hourlyLabel}
        />
        <BarChart
          {...chartProps}
          id="chart-wake"
          metricLabel={translate(BackofficeCopyKey.MetricsWakeTitle)}
          series={[wakeSeries]}
          totalText={percentText(overallWake)}
          isHourly
        />
      </section>
      <section class="card" aria-labelledby="metrics-budget-title">
        <h2 id="metrics-budget-title">{translate(BackofficeCopyKey.MetricsBudgetTitle)}</h2>
        <p class="figure-freshness">{hourlyLabel}</p>
        <FigureNumber
          id="figure-budget-used"
          label={translate(BackofficeCopyKey.MetricsBudgetTitle)}
          value={String(Math.round(report.budgetGigabyteSeconds))}
          cell={MetricCell.BudgetUsed}
          freshness={hourlyLabel}
        />
        <BudgetBar locale={locale} used={report.budgetGigabyteSeconds} />
      </section>
      <section class="card" aria-labelledby="metrics-restricted-title">
        <h2 id="metrics-restricted-title">{translate(BackofficeCopyKey.MetricsRestrictedTitle)}</h2>
        <p class="figure-freshness">{liveLabel}</p>
        <SummaryTable
          caption={translate(BackofficeCopyKey.MetricsRestrictedTitle)}
          emptyText={noData}
          rows={report.restricted.map((entry) => ({
            label: entry.label,
            value: formatTimestamp({ at: entry.restrictedAt }),
            cell: keyedCell({ cell: MetricCell.Restricted, key: entry.numberId }),
          }))}
        />
      </section>
    </Layout>
  );
}

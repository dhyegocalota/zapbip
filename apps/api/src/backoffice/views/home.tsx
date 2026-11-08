import { WhatsAppNumberState } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { NoticeVariant } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { Notice } from '../components/notice';
import { type HomeOverview, SparklineMetric } from '../home-sparklines';
import { Layout } from '../layout';
import type { PageContext } from '../page-context';
import { StateBadge } from '../numbers/components/state-badge';
import { Sparkline } from './sparkline';

export type NumberStateCounts = Record<WhatsAppNumberState, number>;

const SPARKLINE_LABELS: Record<SparklineMetric, BackofficeCopyKey> = {
  [SparklineMetric.Numbers]: BackofficeCopyKey.SparklineNumbersMetric,
  [SparklineMetric.Messages]: BackofficeCopyKey.SparklineMessagesMetric,
  [SparklineMetric.Audit]: BackofficeCopyKey.SparklineAuditMetric,
};

export function HomePage(props: { page: PageContext; overview: HomeOverview }) {
  const { page, overview } = props;
  const { counts, series } = overview;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  const totalNumbers = Object.values(counts).reduce((total, count) => total + count, 0);
  const hasNumbers = totalNumbers > 0;
  const sparklineOf = (metric: SparklineMetric) => (
    <Sparkline locale={locale} metricLabel={translate(SPARKLINE_LABELS[metric])} values={series[metric]} />
  );
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.HomeTitle)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Home}
      notice={page.notice}
    >
      <h1>{translate(BackofficeCopyKey.HomeTitle)}</h1>
      <div class="card-grid">
        <section class="card hero-card" aria-labelledby="home-numbers-title">
          <h2 id="home-numbers-title">{translate(BackofficeCopyKey.HomeNumbersTitle)}</h2>
          {hasNumbers ? (
            <>
              <p class="tile-figure">
                {totalNumbers}
                <span class="tile-unit">{translate(BackofficeCopyKey.HomeNumbersUnit)}</span>
              </p>
              <ul class="state-counts">
                {Object.values(WhatsAppNumberState).map((state) => (
                  <li>
                    <StateBadge locale={locale} state={state} /> <span>{counts[state]}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Notice variant={NoticeVariant.Warning} locale={locale} message={translate(BackofficeCopyKey.HomeNoNumbersWarning)} />
          )}
          <a href={BackofficePath.Numbers} class="button button-primary button-arrow">
            {translate(hasNumbers ? BackofficeCopyKey.HomeManageNumbers : BackofficeCopyKey.HomeRegisterNumber)}
          </a>
          {sparklineOf(SparklineMetric.Numbers)}
        </section>
        <section class="card" aria-labelledby="home-metrics-title">
          <h2 id="home-metrics-title">{translate(BackofficeCopyKey.HomeMetricsTitle)}</h2>
          <p>{translate(BackofficeCopyKey.HomeMetricsBody)}</p>
          <a href={BackofficePath.Metrics} class="button button-secondary button-arrow">
            {translate(BackofficeCopyKey.HomeMetricsLink)}
          </a>
          {sparklineOf(SparklineMetric.Messages)}
        </section>
        <section class="card" aria-labelledby="home-audit-title">
          <h2 id="home-audit-title">{translate(BackofficeCopyKey.HomeAuditTitle)}</h2>
          <p>{translate(BackofficeCopyKey.HomeAuditBody)}</p>
          <a href={BackofficePath.Audit} class="button button-secondary button-arrow">
            {translate(BackofficeCopyKey.HomeAuditLink)}
          </a>
          {sparklineOf(SparklineMetric.Audit)}
        </section>
      </div>
    </Layout>
  );
}

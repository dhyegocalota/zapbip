import { WhatsAppNumberState } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { NoticeVariant } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { Notice } from '../components/notice';
import { Layout } from '../layout';
import type { PageContext } from '../page-context';

export type NumberStateCounts = Record<WhatsAppNumberState, number>;

const STATE_LABELS: Record<WhatsAppNumberState, BackofficeCopyKey> = {
  [WhatsAppNumberState.Active]: BackofficeCopyKey.StateActive,
  [WhatsAppNumberState.Closed]: BackofficeCopyKey.StateClosed,
  [WhatsAppNumberState.Pending]: BackofficeCopyKey.StatePending,
  [WhatsAppNumberState.Disabled]: BackofficeCopyKey.StateDisabled,
};

export function HomePage(props: { page: PageContext; counts: NumberStateCounts }) {
  const { page, counts } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  const hasNumbers = Object.values(counts).some((count) => count > 0);
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
        <section class="card" aria-labelledby="home-numbers-title">
          <h2 id="home-numbers-title">{translate(BackofficeCopyKey.HomeNumbersTitle)}</h2>
          {hasNumbers ? (
            <ul class="state-counts">
              {Object.values(WhatsAppNumberState).map((state) => (
                <li>
                  <span class={`state-badge state-${state}`}>{translate(STATE_LABELS[state])}</span> <span>{counts[state]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Notice variant={NoticeVariant.Warning} locale={locale} message={translate(BackofficeCopyKey.HomeNoNumbersWarning)} />
          )}
          <a href={BackofficePath.Numbers} class="button button-primary">
            {translate(hasNumbers ? BackofficeCopyKey.HomeManageNumbers : BackofficeCopyKey.HomeRegisterNumber)}
          </a>
        </section>
        <section class="card" aria-labelledby="home-metrics-title">
          <h2 id="home-metrics-title">{translate(BackofficeCopyKey.HomeMetricsTitle)}</h2>
          <a href={BackofficePath.Metrics} class="button button-secondary">
            {translate(BackofficeCopyKey.HomeMetricsLink)}
          </a>
        </section>
        <section class="card" aria-labelledby="home-audit-title">
          <h2 id="home-audit-title">{translate(BackofficeCopyKey.HomeAuditTitle)}</h2>
          <a href={BackofficePath.Audit} class="button button-secondary">
            {translate(BackofficeCopyKey.HomeAuditLink)}
          </a>
        </section>
      </div>
    </Layout>
  );
}

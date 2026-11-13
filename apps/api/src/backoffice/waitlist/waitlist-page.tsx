import { WAITLIST_REFERRAL_CAP_MAX, WAITLIST_REFERRAL_CAP_MIN } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { WAITLIST_PAGE_ROW_LIMIT } from '../backoffice-constants';
import { NoticeVariant } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { CodeField } from '../components/fields';
import { Notice } from '../components/notice';
import { formatTimestamp } from '../format-timestamp';
import { Layout } from '../layout';
import type { PageContext } from '../page-context';
import { NumberFormField } from '../numbers/number-form-fields';
import { SOURCE_LABELS } from './source-labels';
import type { WaitlistListRow } from './waitlist-csv';
import { WaitlistFormField } from './waitlist-form-fields';

export type WaitlistPageProps = {
  page: PageContext;
  total: number;
  rows: WaitlistListRow[];
  cap: number | null;
  failure: BackofficeCopyKey | null;
  capError: BackofficeCopyKey | null;
};

const CAP_MISSING_PLACEHOLDER = '—';

export function WaitlistPage(props: WaitlistPageProps) {
  const { page, total, rows, cap, failure, capError } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const rangeValues = { min: String(WAITLIST_REFERRAL_CAP_MIN), max: String(WAITLIST_REFERRAL_CAP_MAX) };
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.WaitlistTitle)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Waitlist}
      notice={page.notice}
      theme={page.theme}
      returnPath={page.returnPath}
    >
      <div class="page-head">
        <h1>{translate(BackofficeCopyKey.WaitlistTitle)}</h1>
        <a href={BackofficePath.WaitlistExport} class="button button-secondary" download>
          {translate(BackofficeCopyKey.WaitlistExport)}
        </a>
      </div>
      <p>{translate(BackofficeCopyKey.WaitlistIntro)}</p>
      {failure === null ? null : <Notice variant={NoticeVariant.Error} locale={locale} message={translate(failure)} />}
      <div class="figure-grid">
        <div class="figure">
          <p id="figure-waitlist-total" class="figure-label">
            {translate(BackofficeCopyKey.WaitlistTotalLabel)}
          </p>
          <p class="figure-value" aria-labelledby="figure-waitlist-total" data-total={total}>
            {total}
          </p>
        </div>
        <div class="figure">
          <p id="figure-waitlist-cap" class="figure-label">
            {translate(BackofficeCopyKey.WaitlistCapLabel)}
          </p>
          <p class="figure-value" aria-labelledby="figure-waitlist-cap">
            {cap === null ? CAP_MISSING_PLACEHOLDER : cap}
            <span class="tile-unit">{translate(BackofficeCopyKey.WaitlistCapUnit)}</span>
          </p>
        </div>
      </div>
      <div class="detail-grid">
        <section class="card form-card" aria-labelledby="waitlist-cap-title">
          <h2 id="waitlist-cap-title">{translate(BackofficeCopyKey.WaitlistCapTitle)}</h2>
          {cap === null ? (
            <Notice variant={NoticeVariant.Error} locale={locale} message={translate(BackofficeCopyKey.WaitlistCapMissing)} />
          ) : (
            <>
              <p class="field-help">{translate(BackofficeCopyKey.WaitlistCapHelp)}</p>
              <form method="post" action={BackofficePath.WaitlistCap}>
                <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
                <div class="field">
                  <label for="waitlist-cap">{translate(BackofficeCopyKey.WaitlistCapField)}</label>
                  <p id="waitlist-cap-help" class="field-help">
                    {translate(BackofficeCopyKey.WaitlistCapFieldHelp, rangeValues)}
                  </p>
                  {capError === null ? null : (
                    <p id="waitlist-cap-error" class="field-help field-error">
                      {translate(capError, rangeValues)}
                    </p>
                  )}
                  <input
                    id="waitlist-cap"
                    name={WaitlistFormField.Cap}
                    type="number"
                    inputmode="numeric"
                    min={WAITLIST_REFERRAL_CAP_MIN}
                    max={WAITLIST_REFERRAL_CAP_MAX}
                    step={1}
                    value={cap}
                    aria-describedby={capError === null ? 'waitlist-cap-help' : 'waitlist-cap-help waitlist-cap-error'}
                    aria-invalid={capError === null ? undefined : 'true'}
                    required
                  />
                </div>
                <CodeField locale={locale} id="waitlist-cap-code" />
                <button type="submit" class="button button-primary">
                  {translate(BackofficeCopyKey.WaitlistCapSubmit)}
                </button>
              </form>
            </>
          )}
        </section>
        {total === 0 ? (
          <section class="card empty-state" aria-labelledby="waitlist-empty-title">
            <h2 id="waitlist-empty-title">{translate(BackofficeCopyKey.WaitlistEmptyTitle)}</h2>
            <p>{translate(BackofficeCopyKey.WaitlistEmptyBody)}</p>
          </section>
        ) : (
          <div>
            {total > WAITLIST_PAGE_ROW_LIMIT ? (
              <Notice
                variant={NoticeVariant.Info}
                locale={locale}
                message={translate(BackofficeCopyKey.WaitlistTruncated, { limit: String(WAITLIST_PAGE_ROW_LIMIT) })}
              />
            ) : null}
            <table class="data-table">
              <caption class="visually-hidden">{translate(BackofficeCopyKey.WaitlistTitle)}</caption>
              <thead>
                <tr>
                  <th scope="col">{translate(BackofficeCopyKey.WaitlistColumnPosition)}</th>
                  <th scope="col">{translate(BackofficeCopyKey.WaitlistColumnEmail)}</th>
                  <th scope="col">{translate(BackofficeCopyKey.WaitlistColumnJoined)}</th>
                  <th scope="col">{translate(BackofficeCopyKey.WaitlistColumnCredited)}</th>
                  <th scope="col">{translate(BackofficeCopyKey.WaitlistColumnReferredBy)}</th>
                  <th scope="col">{translate(BackofficeCopyKey.WaitlistColumnSource)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr class="waitlist-row">
                    <td data-label={translate(BackofficeCopyKey.WaitlistColumnPosition)}>{index + 1}</td>
                    <td data-label={translate(BackofficeCopyKey.WaitlistColumnEmail)} class="mono cell-truncate">
                      {row.email}
                    </td>
                    <td data-label={translate(BackofficeCopyKey.WaitlistColumnJoined)}>
                      <time datetime={new Date(row.joinedAt).toISOString()}>{formatTimestamp({ at: row.joinedAt })}</time>
                    </td>
                    <td data-label={translate(BackofficeCopyKey.WaitlistColumnCredited)} class="cell-nowrap">
                      {row.creditedCount}
                    </td>
                    <td data-label={translate(BackofficeCopyKey.WaitlistColumnReferredBy)} class="mono cell-truncate">
                      {row.referredByEmail}
                    </td>
                    <td data-label={translate(BackofficeCopyKey.WaitlistColumnSource)}>{translate(SOURCE_LABELS[row.source])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

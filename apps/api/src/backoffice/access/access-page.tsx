import { ACCESS_BATCH_LIMIT, OwnerLocale, WaitlistSource } from '@zapbip/types';
import { maskedPhoneOf } from '@zapbip/core';
import { SOURCE_LABELS } from '../waitlist/source-labels';
import { ACCESS_PAGE_ROW_LIMIT } from '../backoffice-constants';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { NoticeVariant } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { CodeField } from '../components/fields';
import { Notice } from '../components/notice';
import { formatTimestamp } from '../format-timestamp';
import { NumberFormField } from '../numbers/number-form-fields';
import type { PageContext } from '../page-context';
import { AccessFormField } from './access-form-fields';
import { type AccessFilter, AccessSource } from './access-filter';
import type { InvitableEntryRow, WaitingAccountRow } from './access-queries';
import { AccessShell } from './access-shell';
import { LOCALE_PROFILES } from '../../web-shell/locale-profiles';

export type AccessPageProps = {
  page: PageContext;
  filter: AccessFilter;
  failure: BackofficeCopyKey | null;
  waiting: { total: number; rows: WaitingAccountRow[] };
  invitable: { total: number; rows: InvitableEntryRow[] };
};

const SELECT_ALL_VALUE = '1';
const SOURCE_OPTIONS: { source: AccessSource; label: BackofficeCopyKey }[] = [
  { source: AccessSource.Form, label: SOURCE_LABELS[WaitlistSource.Form] },
  { source: AccessSource.Agent, label: SOURCE_LABELS[WaitlistSource.Agent] },
  { source: AccessSource.All, label: BackofficeCopyKey.AccessFilterSourceAll },
];

function FilterFields(props: { filter: AccessFilter }) {
  const { filter } = props;
  return (
    <>
      <input type="hidden" name={AccessFormField.From} value={filter.from === null ? '' : filter.from} />
      <input type="hidden" name={AccessFormField.To} value={filter.to === null ? '' : filter.to} />
      <input type="hidden" name={AccessFormField.Locale} value={filter.locale === null ? '' : filter.locale} />
      <input type="hidden" name={AccessFormField.Source} value={filter.source} />
    </>
  );
}

export function AccessPage(props: AccessPageProps) {
  const { page, filter, failure, waiting, invitable } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const limitValues = { limit: String(ACCESS_BATCH_LIMIT) };
  return (
    <AccessShell page={page} title={BackofficeCopyKey.AccessTitle}>
      <p>{translate(BackofficeCopyKey.AccessIntro)}</p>
      {failure === null ? null : <Notice variant={NoticeVariant.Error} locale={locale} message={translate(failure, limitValues)} />}
      <form method="get" action={BackofficePath.Access} class="filter-form" aria-label={translate(BackofficeCopyKey.AccessFilterTitle)}>
        <div class="field">
          <label for="access-from">{translate(BackofficeCopyKey.AccessFilterFrom)}</label>
          <input id="access-from" name={AccessFormField.From} type="date" value={filter.from === null ? undefined : filter.from} />
        </div>
        <div class="field">
          <label for="access-to">{translate(BackofficeCopyKey.AccessFilterTo)}</label>
          <input id="access-to" name={AccessFormField.To} type="date" value={filter.to === null ? undefined : filter.to} />
        </div>
        <div class="field">
          <label for="access-locale">{translate(BackofficeCopyKey.AccessFilterLocale)}</label>
          <select id="access-locale" name={AccessFormField.Locale}>
            <option value="" selected={filter.locale === null}>
              {translate(BackofficeCopyKey.AccessFilterAnyLocale)}
            </option>
            {Object.values(OwnerLocale).map((option) => (
              <option value={option} selected={filter.locale === option}>
                {LOCALE_PROFILES[option].nativeName}
              </option>
            ))}
          </select>
        </div>
        <div class="field">
          <label for="access-source">{translate(BackofficeCopyKey.AccessFilterSource)}</label>
          <select id="access-source" name={AccessFormField.Source}>
            {SOURCE_OPTIONS.map((option) => (
              <option value={option.source} selected={filter.source === option.source}>
                {translate(option.label)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" class="button button-secondary">
          {translate(BackofficeCopyKey.AccessFilterApply)}
        </button>
      </form>
      <>
        <section class="card form-card" aria-labelledby="access-waiting-title">
          <h2 id="access-waiting-title">{translate(BackofficeCopyKey.AccessWaitingTitle)}</h2>
          <p class="field-help" data-total={waiting.total}>
            {translate(BackofficeCopyKey.AccessWaitingHelp)}
          </p>
          {waiting.rows.length === 0 ? (
            <p class="empty-inline">{translate(BackofficeCopyKey.AccessWaitingEmpty)}</p>
          ) : (
            <form method="post" action={BackofficePath.AccessRelease}>
              <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
              <FilterFields filter={filter} />
              {waiting.total > ACCESS_PAGE_ROW_LIMIT ? (
                <Notice
                  variant={NoticeVariant.Info}
                  locale={locale}
                  message={translate(BackofficeCopyKey.AccessWaitingTruncated, {
                    limit: String(ACCESS_PAGE_ROW_LIMIT),
                    total: String(waiting.total),
                  })}
                />
              ) : null}
              <table class="data-table">
                <caption class="visually-hidden">{translate(BackofficeCopyKey.AccessWaitingTitle)}</caption>
                <thead>
                  <tr>
                    <th scope="col">{translate(BackofficeCopyKey.AccessColumnSelect)}</th>
                    <th scope="col">{translate(BackofficeCopyKey.AccessColumnPhone)}</th>
                    <th scope="col">{translate(BackofficeCopyKey.AccessColumnJoined)}</th>
                    <th scope="col">{translate(BackofficeCopyKey.AccessColumnLanguage)}</th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.rows.map((row) => (
                    <tr class="access-row">
                      <td data-label={translate(BackofficeCopyKey.AccessColumnSelect)}>
                        <input
                          type="checkbox"
                          name={AccessFormField.Account}
                          value={row.accountId}
                          aria-label={maskedPhoneOf({ waId: row.waId })}
                        />
                      </td>
                      <td data-label={translate(BackofficeCopyKey.AccessColumnPhone)} class="mono cell-nowrap">
                        {maskedPhoneOf({ waId: row.waId })}
                      </td>
                      <td data-label={translate(BackofficeCopyKey.AccessColumnJoined)} class="cell-nowrap">
                        <time datetime={new Date(row.joinedAt).toISOString()}>{formatTimestamp({ at: row.joinedAt })}</time>
                      </td>
                      <td data-label={translate(BackofficeCopyKey.AccessColumnLanguage)}>{LOCALE_PROFILES[row.locale].nativeName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label class="choice">
                <input type="checkbox" name={AccessFormField.SelectAll} value={SELECT_ALL_VALUE} />
                {translate(BackofficeCopyKey.AccessSelectAll, limitValues)}
              </label>
              <CodeField locale={locale} id="access-release-code" />
              <button type="submit" class="button button-primary">
                {translate(BackofficeCopyKey.AccessReleaseSubmit)}
              </button>
            </form>
          )}
        </section>
        <section class="card form-card" aria-labelledby="access-invite-title">
          <h2 id="access-invite-title">{translate(BackofficeCopyKey.AccessInviteTitle)}</h2>
          <p class="field-help" data-total={invitable.total}>
            {translate(BackofficeCopyKey.AccessInviteHelp)}
          </p>
          {invitable.rows.length === 0 ? (
            <p class="empty-inline">{translate(BackofficeCopyKey.AccessInviteEmpty)}</p>
          ) : (
            <form method="post" action={BackofficePath.AccessInvite}>
              <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
              <FilterFields filter={filter} />
              {invitable.total > ACCESS_PAGE_ROW_LIMIT ? (
                <Notice
                  variant={NoticeVariant.Info}
                  locale={locale}
                  message={translate(BackofficeCopyKey.AccessInviteTruncated, {
                    limit: String(ACCESS_PAGE_ROW_LIMIT),
                    total: String(invitable.total),
                  })}
                />
              ) : null}
              <table class="data-table">
                <caption class="visually-hidden">{translate(BackofficeCopyKey.AccessInviteTitle)}</caption>
                <thead>
                  <tr>
                    <th scope="col">{translate(BackofficeCopyKey.AccessColumnSelect)}</th>
                    <th scope="col">{translate(BackofficeCopyKey.AccessColumnEmail)}</th>
                    <th scope="col">{translate(BackofficeCopyKey.AccessColumnJoined)}</th>
                    <th scope="col">{translate(BackofficeCopyKey.AccessColumnLanguage)}</th>
                    <th scope="col">{translate(BackofficeCopyKey.AccessColumnSource)}</th>
                  </tr>
                </thead>
                <tbody>
                  {invitable.rows.map((row) => (
                    <tr class="access-row">
                      <td data-label={translate(BackofficeCopyKey.AccessColumnSelect)}>
                        <input type="checkbox" name={AccessFormField.Email} value={row.email} aria-label={row.email} />
                      </td>
                      <td data-label={translate(BackofficeCopyKey.AccessColumnEmail)} class="mono cell-truncate">
                        {row.email}
                      </td>
                      <td data-label={translate(BackofficeCopyKey.AccessColumnJoined)} class="cell-nowrap">
                        <time datetime={new Date(row.joinedAt).toISOString()}>{formatTimestamp({ at: row.joinedAt })}</time>
                      </td>
                      <td data-label={translate(BackofficeCopyKey.AccessColumnLanguage)}>{LOCALE_PROFILES[row.locale].nativeName}</td>
                      <td data-label={translate(BackofficeCopyKey.AccessColumnSource)}>{translate(SOURCE_LABELS[row.source])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label class="choice">
                <input type="checkbox" name={AccessFormField.SelectAll} value={SELECT_ALL_VALUE} />
                {translate(BackofficeCopyKey.AccessSelectAll, limitValues)}
              </label>
              <CodeField locale={locale} id="access-invite-code" />
              <button type="submit" class="button button-primary">
                {translate(BackofficeCopyKey.AccessInviteSubmit)}
              </button>
            </form>
          )}
        </section>
      </>
    </AccessShell>
  );
}

import { WhatsAppNumberState } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';
import { NoticeVariant } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { Notice } from '../../components/notice';
import { formatTimestamp } from '../../format-timestamp';
import { Layout } from '../../layout';
import type { PageContext } from '../../page-context';
import type { NumberListEntry } from '../../../numbers/number-admin';
import { StateBadge } from '../components/state-badge';
import { numberPath, NumberSegment } from '../number-paths';

export function NumbersListPage(props: { page: PageContext; entries: NumberListEntry[] }) {
  const { page, entries } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const hasPending = entries.some((entry) => entry.state === WhatsAppNumberState.Pending);
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.NumbersTitle)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Numbers}
      notice={page.notice}
    >
      <h1>{translate(BackofficeCopyKey.NumbersTitle)}</h1>
      <a href={`${BackofficePath.Numbers}/${NumberSegment.New}`} class="button button-primary">
        {translate(BackofficeCopyKey.NumbersRegister)}
      </a>
      {entries.length === 0 ? (
        <section class="card" aria-labelledby="numbers-empty-title">
          <h2 id="numbers-empty-title">{translate(BackofficeCopyKey.NumbersEmptyTitle)}</h2>
          <p>{translate(BackofficeCopyKey.NumbersEmptyBody)}</p>
        </section>
      ) : (
        <table class="data-table">
          <caption class="visually-hidden">{translate(BackofficeCopyKey.NumbersCaption)}</caption>
          <thead>
            <tr>
              <th scope="col">{translate(BackofficeCopyKey.NumbersColumnLabel)}</th>
              <th scope="col">{translate(BackofficeCopyKey.NumbersColumnDisplayNumber)}</th>
              <th scope="col">{translate(BackofficeCopyKey.NumbersColumnState)}</th>
              <th scope="col">{translate(BackofficeCopyKey.NumbersColumnMetaApp)}</th>
              <th scope="col">{translate(BackofficeCopyKey.NumbersColumnAccounts)}</th>
              <th scope="col">{translate(BackofficeCopyKey.NumbersColumnVerified)}</th>
              <th scope="col">{translate(BackofficeCopyKey.NumbersColumnUpdated)}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr class="number-row">
                <td data-label={translate(BackofficeCopyKey.NumbersColumnLabel)}>
                  <a href={numberPath({ numberId: entry.numberId })}>{entry.label}</a>
                </td>
                <td data-label={translate(BackofficeCopyKey.NumbersColumnDisplayNumber)} class="mono">
                  {entry.displayNumber}
                </td>
                <td data-label={translate(BackofficeCopyKey.NumbersColumnState)}>
                  <StateBadge locale={locale} state={entry.state} />
                </td>
                <td data-label={translate(BackofficeCopyKey.NumbersColumnMetaApp)}>{entry.metaAppLabel}</td>
                <td data-label={translate(BackofficeCopyKey.NumbersColumnAccounts)}>{entry.accountCount}</td>
                <td data-label={translate(BackofficeCopyKey.NumbersColumnVerified)}>
                  {entry.verifiedAt === null ? translate(BackofficeCopyKey.NumbersNotVerified) : formatTimestamp({ at: entry.verifiedAt })}
                </td>
                <td data-label={translate(BackofficeCopyKey.NumbersColumnUpdated)}>{formatTimestamp({ at: entry.updatedAt })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hasPending ? (
        <Notice variant={NoticeVariant.Warning} locale={locale} message={translate(BackofficeCopyKey.NumbersPendingWarning)} />
      ) : null}
    </Layout>
  );
}

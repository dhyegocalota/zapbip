import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';
import { NoticeVariant } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { Notice } from '../../components/notice';
import { formatTimestamp } from '../../format-timestamp';
import { Layout } from '../../layout';
import type { PageContext } from '../../page-context';
import { GraphErrorKind } from '../../../numbers/graph-error-kind';
import { TemplateStatus, VerificationOutcome, type VerificationSnapshot } from '../../../numbers/number-verification';
import { numberPath } from '../number-paths';

const ERROR_COPY: Record<GraphErrorKind, BackofficeCopyKey> = {
  [GraphErrorKind.Auth]: BackofficeCopyKey.VerifyErrorAuth,
  [GraphErrorKind.NotFound]: BackofficeCopyKey.VerifyErrorNotFound,
  [GraphErrorKind.Network]: BackofficeCopyKey.VerifyErrorNetwork,
  [GraphErrorKind.Upstream]: BackofficeCopyKey.VerifyErrorUpstream,
};
const TEMPLATE_STATUS_COPY: Record<TemplateStatus, BackofficeCopyKey> = {
  [TemplateStatus.Approved]: BackofficeCopyKey.VerifyTemplateStatusApproved,
  [TemplateStatus.Pending]: BackofficeCopyKey.VerifyTemplateStatusPending,
  [TemplateStatus.Rejected]: BackofficeCopyKey.VerifyTemplateStatusRejected,
  [TemplateStatus.Missing]: BackofficeCopyKey.VerifyTemplateStatusMissing,
};

function VerificationNotice(props: { page: PageContext; snapshot: VerificationSnapshot }) {
  const { page, snapshot } = props;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale: page.locale });
  if (snapshot.outcome === VerificationOutcome.Verified) {
    return <Notice variant={NoticeVariant.Success} locale={page.locale} message={translate(BackofficeCopyKey.VerifyOk)} />;
  }
  if (snapshot.outcome === VerificationOutcome.Mismatch) {
    return <Notice variant={NoticeVariant.Error} locale={page.locale} message={translate(BackofficeCopyKey.VerifyMismatch)} />;
  }
  if (snapshot.errorKind === null) throw new Error('a failed verification has no error kind');
  return <Notice variant={NoticeVariant.Error} locale={page.locale} message={translate(ERROR_COPY[snapshot.errorKind])} />;
}

export function NumberVerificationPage(props: { page: PageContext; numberId: string; label: string; snapshot: VerificationSnapshot }) {
  const { page, numberId, label, snapshot } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const hasMetaReport = snapshot.outcome !== VerificationOutcome.Failed;
  const hasUnapprovedTemplate = snapshot.templates.some((template) => template.status !== TemplateStatus.Approved);
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.VerifyResultTitle, { label })}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Numbers}
      notice={page.notice}
    >
      <h1>{translate(BackofficeCopyKey.VerifyResultTitle, { label })}</h1>
      <VerificationNotice page={page} snapshot={snapshot} />
      {snapshot.outcome === VerificationOutcome.Mismatch ? (
        <dl class="key-value">
          <dt>{translate(BackofficeCopyKey.VerifyExpectedNumber)}</dt>
          <dd class="mono">{snapshot.expectedDigits}</dd>
          <dt>{translate(BackofficeCopyKey.VerifyReportedNumber)}</dt>
          <dd class="mono">{snapshot.reportedDigits}</dd>
        </dl>
      ) : null}
      {hasMetaReport ? (
        <section class="card" aria-labelledby="meta-reports-title">
          <h2 id="meta-reports-title">{translate(BackofficeCopyKey.VerifyMetaReports)}</h2>
          <dl class="key-value">
            <dt>{translate(BackofficeCopyKey.VerifyVerifiedName)}</dt>
            <dd>{snapshot.verifiedName}</dd>
            <dt>{translate(BackofficeCopyKey.VerifyQualityRating)}</dt>
            <dd>{snapshot.qualityRating}</dd>
          </dl>
        </section>
      ) : null}
      {snapshot.templates.length === 0 ? null : (
        <section class="card" aria-labelledby="templates-title">
          <h2 id="templates-title">{translate(BackofficeCopyKey.VerifyTemplatesTitle)}</h2>
          <table class="data-table">
            <caption class="visually-hidden">{translate(BackofficeCopyKey.VerifyTemplatesTitle)}</caption>
            <thead>
              <tr>
                <th scope="col">{translate(BackofficeCopyKey.VerifyTemplateName)}</th>
                <th scope="col">{translate(BackofficeCopyKey.NumbersColumnState)}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.templates.map((template) => (
                <tr class="template-row">
                  <td data-label={translate(BackofficeCopyKey.VerifyTemplateName)} class="mono">
                    {template.name} {template.language}
                  </td>
                  <td data-label={translate(BackofficeCopyKey.NumbersColumnState)}>{translate(TEMPLATE_STATUS_COPY[template.status])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasUnapprovedTemplate ? (
            <Notice variant={NoticeVariant.Warning} locale={locale} message={translate(BackofficeCopyKey.VerifyTemplatesWarning)} />
          ) : null}
        </section>
      )}
      <p>{translate(BackofficeCopyKey.VerifyCheckedAt, { date: formatTimestamp({ at: snapshot.checkedAt }) })}</p>
      <a href={numberPath({ numberId })} class="button button-secondary">
        {translate(BackofficeCopyKey.VerifyBack, { label })}
      </a>
    </Layout>
  );
}

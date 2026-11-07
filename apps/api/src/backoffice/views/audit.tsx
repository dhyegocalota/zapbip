import { BackofficeAuditAction, BackofficeAuditOutcome } from '../audit/backoffice-audit-action';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';
import { formatTimestamp } from '../format-timestamp';
import { Layout } from '../layout';
import type { PageContext } from '../page-context';

export type AuditListRow = {
  at: number;
  action: BackofficeAuditAction;
  target_kind: string | null;
  target_id: string | null;
  outcome: BackofficeAuditOutcome;
  client_address: string | null;
};

const ACTION_LABELS: Record<BackofficeAuditAction, BackofficeCopyKey> = {
  [BackofficeAuditAction.OperatorEnrolled]: BackofficeCopyKey.AuditActionOperatorEnrolled,
  [BackofficeAuditAction.SignInSucceeded]: BackofficeCopyKey.AuditActionSignInSucceeded,
  [BackofficeAuditAction.SignInFailed]: BackofficeCopyKey.AuditActionSignInFailed,
  [BackofficeAuditAction.SignInLocked]: BackofficeCopyKey.AuditActionSignInLocked,
  [BackofficeAuditAction.StepUpFailed]: BackofficeCopyKey.AuditActionStepUpFailed,
  [BackofficeAuditAction.SignOut]: BackofficeCopyKey.AuditActionSignOut,
  [BackofficeAuditAction.NumberRegistered]: BackofficeCopyKey.AuditActionNumberRegistered,
  [BackofficeAuditAction.NumberVerified]: BackofficeCopyKey.AuditActionNumberVerified,
  [BackofficeAuditAction.NumberAccessTokenRotated]: BackofficeCopyKey.AuditActionNumberAccessTokenRotated,
  [BackofficeAuditAction.MetaAppSecretRotated]: BackofficeCopyKey.AuditActionMetaAppSecretRotated,
  [BackofficeAuditAction.NumberStateChanged]: BackofficeCopyKey.AuditActionNumberStateChanged,
};
const OUTCOME_LABELS: Record<BackofficeAuditOutcome, BackofficeCopyKey> = {
  [BackofficeAuditOutcome.Succeeded]: BackofficeCopyKey.AuditOutcomeSucceeded,
  [BackofficeAuditOutcome.Failed]: BackofficeCopyKey.AuditOutcomeFailed,
  [BackofficeAuditOutcome.Locked]: BackofficeCopyKey.AuditOutcomeLocked,
};

export function AuditPage(props: { page: PageContext; rows: AuditListRow[] }) {
  const { page, rows } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.AuditTitle)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Audit}
      notice={page.notice}
    >
      <h1>{translate(BackofficeCopyKey.AuditTitle)}</h1>
      <p>{translate(BackofficeCopyKey.AuditIntro)}</p>
      {rows.length === 0 ? (
        <p>{translate(BackofficeCopyKey.AuditEmpty)}</p>
      ) : (
        <table class="data-table">
          <caption class="visually-hidden">{translate(BackofficeCopyKey.AuditTitle)}</caption>
          <thead>
            <tr>
              <th scope="col">{translate(BackofficeCopyKey.AuditColumnWhen)}</th>
              <th scope="col">{translate(BackofficeCopyKey.AuditColumnAction)}</th>
              <th scope="col">{translate(BackofficeCopyKey.AuditColumnTarget)}</th>
              <th scope="col">{translate(BackofficeCopyKey.AuditColumnOutcome)}</th>
              <th scope="col">{translate(BackofficeCopyKey.AuditColumnAddress)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr class="audit-row">
                <td data-label={translate(BackofficeCopyKey.AuditColumnWhen)}>
                  <time datetime={new Date(row.at).toISOString()}>{formatTimestamp({ at: row.at })}</time>
                </td>
                <td data-label={translate(BackofficeCopyKey.AuditColumnAction)}>{translate(ACTION_LABELS[row.action])}</td>
                <td data-label={translate(BackofficeCopyKey.AuditColumnTarget)} class="mono">
                  {row.target_id}
                </td>
                <td data-label={translate(BackofficeCopyKey.AuditColumnOutcome)} class={`outcome outcome-${row.outcome}`}>
                  {translate(OUTCOME_LABELS[row.outcome])}
                </td>
                <td data-label={translate(BackofficeCopyKey.AuditColumnAddress)} class="mono">
                  {row.client_address}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}

import { maskedPhoneOf } from '../../client-app/masked-phone';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';
import { NumberFormField } from '../numbers/number-form-fields';
import type { PageContext } from '../page-context';
import type { BatchCounts } from './access-batch-counts';
import { AccessFormField } from './access-form-fields';
import type { IssuedInvite } from './access-invite';
import type { ReleasedAccount } from './access-release';
import { AccessShell } from './access-shell';
import { toInviteLines } from './invite-csv';
import { AccessNoticeOutcome } from '@zapbip/types';

const RELEASE_COUNT_LABELS: Record<string, BackofficeCopyKey> = {
  selected: BackofficeCopyKey.AccessResultSelected,
  released: BackofficeCopyKey.AccessResultReleased,
  alreadyActive: BackofficeCopyKey.AccessResultAlreadyActive,
  notReleasable: BackofficeCopyKey.AccessResultNotReleasable,
  sent: BackofficeCopyKey.AccessResultSent,
  queued: BackofficeCopyKey.AccessResultQueued,
  failed: BackofficeCopyKey.AccessResultFailed,
};
const INVITE_COUNT_LABELS: Record<string, BackofficeCopyKey> = {
  selected: BackofficeCopyKey.AccessResultSelected,
  issued: BackofficeCopyKey.AccessInviteResultIssued,
  skipped: BackofficeCopyKey.AccessInviteResultSkipped,
};
const LINKS_ROWS = 6;

function CountFigures(props: { page: PageContext; counts: BatchCounts; labels: Record<string, BackofficeCopyKey> }) {
  const { page, counts, labels } = props;
  return (
    <div class="figure-grid">
      {Object.entries(counts).map(([name, count]) => (
        <div class="figure">
          <p id={`figure-${name}`} class="figure-label">
            {renderBackofficeCopy({ key: labels[name]!, locale: page.locale })}
          </p>
          <p class="figure-value" aria-labelledby={`figure-${name}`} data-count={name}>
            {count}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AccessReleaseResultPage(props: { page: PageContext; counts: BatchCounts; rows: ReleasedAccount[] }) {
  const { page, counts, rows } = props;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale: page.locale });
  const failedRows = rows.filter((row) => row.notice === AccessNoticeOutcome.Failed && row.waId !== null);
  return (
    <AccessShell page={page} title={BackofficeCopyKey.AccessReleaseResultTitle}>
      <CountFigures page={page} counts={counts} labels={RELEASE_COUNT_LABELS} />
      {failedRows.length === 0 ? null : (
        <section class="card" aria-labelledby="access-failed-title">
          <h2 id="access-failed-title">{translate(BackofficeCopyKey.AccessResultFailedList)}</h2>
          <ul>
            {failedRows.map((row) => (
              <li class="mono">{maskedPhoneOf({ waId: row.waId! })}</li>
            ))}
          </ul>
        </section>
      )}
      <p>
        <a href={BackofficePath.Access} class="button button-secondary">
          {translate(BackofficeCopyKey.AccessResultBack)}
        </a>
      </p>
    </AccessShell>
  );
}

export function AccessInviteResultPage(props: { page: PageContext; counts: BatchCounts; invites: IssuedInvite[] }) {
  const { page, counts, invites } = props;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale: page.locale });
  const lines = toInviteLines({ invites });
  return (
    <AccessShell page={page} title={BackofficeCopyKey.AccessInviteResultTitle}>
      <CountFigures page={page} counts={counts} labels={INVITE_COUNT_LABELS} />
      {invites.length === 0 ? null : (
        <section class="card form-card" aria-labelledby="access-links-title">
          <h2 id="access-links-title">{translate(BackofficeCopyKey.AccessInviteLinksLabel)}</h2>
          <p class="field-help">{translate(BackofficeCopyKey.AccessInviteLinksHelp)}</p>
          <textarea class="access-links mono" readonly rows={LINKS_ROWS} aria-labelledby="access-links-title">
            {invites.map((invite) => invite.link).join('\n')}
          </textarea>
          <table class="data-table">
            <caption class="visually-hidden">{translate(BackofficeCopyKey.AccessInviteLinksLabel)}</caption>
            <thead>
              <tr>
                <th scope="col">{translate(BackofficeCopyKey.AccessColumnEmail)}</th>
                <th scope="col">{translate(BackofficeCopyKey.AccessInviteColumnLink)}</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr>
                  <td data-label={translate(BackofficeCopyKey.AccessColumnEmail)} class="mono cell-truncate">
                    {invite.email}
                  </td>
                  <td data-label={translate(BackofficeCopyKey.AccessInviteColumnLink)} class="mono">
                    <a href={invite.link} rel="noreferrer">
                      {invite.link}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form method="post" action={BackofficePath.AccessInvitesCsv}>
            <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
            <input type="hidden" name={AccessFormField.Links} value={lines} />
            <button type="submit" class="button button-secondary">
              {translate(BackofficeCopyKey.AccessInviteDownload)}
            </button>
          </form>
        </section>
      )}
      <p>
        <a href={BackofficePath.Access} class="button button-secondary">
          {translate(BackofficeCopyKey.AccessResultBack)}
        </a>
      </p>
    </AccessShell>
  );
}

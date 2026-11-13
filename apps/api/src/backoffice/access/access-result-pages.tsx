import { maskedPhoneOf } from '../../client-app/masked-phone';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';
import { NumberFormField } from '../numbers/number-form-fields';
import type { PageContext } from '../page-context';
import { BatchCount, type BatchCounts } from './access-batch-counts';
import { AccessFormField } from './access-form-fields';
import type { IssuedInvite } from './access-invite';
import type { ReleasedAccount } from './access-release';
import { AccessShell } from './access-shell';
import { toInviteLines } from './invite-csv';
import { AccessNoticeOutcome } from '@zapbip/types';

type CountLabel = { count: BatchCount; label: BackofficeCopyKey };

const RELEASE_COUNT_LABELS: CountLabel[] = [
  { count: BatchCount.Selected, label: BackofficeCopyKey.AccessResultSelected },
  { count: BatchCount.Released, label: BackofficeCopyKey.AccessResultReleased },
  { count: BatchCount.AlreadyActive, label: BackofficeCopyKey.AccessResultAlreadyActive },
  { count: BatchCount.NotReleasable, label: BackofficeCopyKey.AccessResultNotReleasable },
  { count: BatchCount.Sent, label: BackofficeCopyKey.AccessResultSent },
  { count: BatchCount.Queued, label: BackofficeCopyKey.AccessResultQueued },
  { count: BatchCount.Failed, label: BackofficeCopyKey.AccessResultFailed },
  { count: BatchCount.ItemFailed, label: BackofficeCopyKey.AccessResultItemFailed },
];
const INVITE_COUNT_LABELS: CountLabel[] = [
  { count: BatchCount.Selected, label: BackofficeCopyKey.AccessResultSelected },
  { count: BatchCount.Issued, label: BackofficeCopyKey.AccessInviteResultIssued },
  { count: BatchCount.Skipped, label: BackofficeCopyKey.AccessInviteResultSkipped },
  { count: BatchCount.ItemFailed, label: BackofficeCopyKey.AccessResultItemFailed },
];
const LINKS_ROWS = 6;

function CountFigures(props: { page: PageContext; counts: BatchCounts; labels: CountLabel[] }) {
  const { page, counts, labels } = props;
  return (
    <div class="figure-grid">
      {labels.flatMap(({ count, label }) => {
        const value = counts[count];
        if (value === undefined) return [];
        return [
          <div class="figure">
            <p id={`figure-${count}`} class="figure-label">
              {renderBackofficeCopy({ key: label, locale: page.locale })}
            </p>
            <p class="figure-value" aria-labelledby={`figure-${count}`} data-count={count}>
              {value}
            </p>
          </div>,
        ];
      })}
    </div>
  );
}

export function AccessReleaseResultPage(props: { page: PageContext; counts: BatchCounts; rows: ReleasedAccount[] }) {
  const { page, counts, rows } = props;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale: page.locale });
  const failedPhones = rows.flatMap((row) =>
    row.notice === AccessNoticeOutcome.Failed && row.waId !== null ? [maskedPhoneOf({ waId: row.waId })] : [],
  );
  return (
    <AccessShell page={page} title={BackofficeCopyKey.AccessReleaseResultTitle}>
      <CountFigures page={page} counts={counts} labels={RELEASE_COUNT_LABELS} />
      {failedPhones.length === 0 ? null : (
        <section class="card" aria-labelledby="access-failed-title">
          <h2 id="access-failed-title">{translate(BackofficeCopyKey.AccessResultFailedList)}</h2>
          <ul>
            {failedPhones.map((phone) => (
              <li class="mono">{phone}</li>
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

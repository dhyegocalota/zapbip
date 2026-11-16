import { WhatsAppNumberState } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';
import { NoticeVariant } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { CodeField } from '../../components/fields';
import { Notice } from '../../components/notice';
import { formatTimestamp } from '../../format-timestamp';
import { Layout } from '../../layout';
import type { PageContext } from '../../page-context';
import type { NumberListEntry } from '../../../numbers/number-admin';
import { StateBadge } from '../components/state-badge';
import { TextField } from '../components/text-field';
import { CHECKED_VALUE, NumberFormField } from '../number-form-fields';
import { numberPath, NumberSegment } from '../number-paths';

export type NumberDetailPageProps = {
  page: PageContext;
  entry: NumberListEntry;
  allowedTargets: WhatsAppNumberState[];
  failure: BackofficeCopyKey | null;
  selectedState: WhatsAppNumberState | null;
};

const TARGET_OPTIONS: Record<WhatsAppNumberState, BackofficeCopyKey> = {
  [WhatsAppNumberState.Pending]: BackofficeCopyKey.StatePending,
  [WhatsAppNumberState.Active]: BackofficeCopyKey.NumberStateOptionActive,
  [WhatsAppNumberState.Closed]: BackofficeCopyKey.NumberStateOptionClosed,
  [WhatsAppNumberState.Disabled]: BackofficeCopyKey.NumberStateOptionDisabled,
};

export function NumberDetailPage(props: NumberDetailPageProps) {
  const { page, entry, allowedTargets, failure, selectedState } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const credentialStatus = (at: number): string => translate(BackofficeCopyKey.CredentialSet, { date: formatTimestamp({ at }) });
  const isUnverifiedPending = entry.state === WhatsAppNumberState.Pending && entry.verifiedAt === null;
  const csrf = <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />;
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={entry.label}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Numbers}
      notice={page.notice}
      theme={page.theme}
      returnPath={page.returnPath}
    >
      <a href={BackofficePath.Numbers} class="crumb">
        {translate(BackofficeCopyKey.NumberBack)}
      </a>
      <div class="title-row">
        <h1>{entry.label}</h1>
        <StateBadge locale={locale} state={entry.state} />
      </div>
      {failure === null ? null : <Notice variant={NoticeVariant.Error} locale={locale} message={translate(failure)} />}
      {isUnverifiedPending ? (
        <Notice variant={NoticeVariant.Warning} locale={locale} message={translate(BackofficeCopyKey.NumbersPendingWarning)} />
      ) : null}
      {entry.state === WhatsAppNumberState.Disabled ? (
        <Notice variant={NoticeVariant.Warning} locale={locale} message={translate(BackofficeCopyKey.NumberDisabledWarning)} />
      ) : null}
      <div class="detail-grid">
        <section class="card hero-card" aria-labelledby="summary-title">
          <h2 id="summary-title">{translate(BackofficeCopyKey.NumberSummaryTitle)}</h2>
          <dl class="key-value">
            <dt>{translate(BackofficeCopyKey.NumberDisplayNumber)}</dt>
            <dd class="mono">{entry.displayNumber}</dd>
            <dt>{translate(BackofficeCopyKey.NumberPhoneNumberId)}</dt>
            <dd class="mono">{entry.phoneNumberId}</dd>
            <dt>{translate(BackofficeCopyKey.NumberWabaId)}</dt>
            <dd class="mono">{entry.wabaId}</dd>
            <dt>{translate(BackofficeCopyKey.NumberAccessToken)}</dt>
            <dd>{credentialStatus(entry.credentialsChangedAt)}</dd>
            <dt>{translate(BackofficeCopyKey.NumberVerifiedAt)}</dt>
            <dd>
              {entry.verifiedAt === null ? translate(BackofficeCopyKey.NumberNeverVerified) : formatTimestamp({ at: entry.verifiedAt })}
            </dd>
            <dt>{translate(BackofficeCopyKey.NumberAccountsBound)}</dt>
            <dd>{entry.accountCount}</dd>
          </dl>
        </section>
        <div class="detail-actions">
          <section class="card" aria-labelledby="verify-title">
            <h2 id="verify-title">{translate(BackofficeCopyKey.NumberVerifyTitle)}</h2>
            <p>{translate(BackofficeCopyKey.NumberVerifyBody)}</p>
            <form method="post" action={numberPath({ numberId: entry.numberId, segment: NumberSegment.Verify })}>
              {csrf}
              <CodeField locale={locale} id="verify-code" />
              <button type="submit" class="button button-primary">
                {translate(BackofficeCopyKey.NumberVerifySubmit)}
              </button>
            </form>
          </section>
          <section class="card" aria-labelledby="pin-title">
            <h2 id="pin-title">{translate(BackofficeCopyKey.NumberPinTitle)}</h2>
            {entry.hasTwoStepPin ? (
              <form method="post" action={numberPath({ numberId: entry.numberId, segment: NumberSegment.Pin })}>
                {csrf}
                <CodeField locale={locale} id="pin-code" />
                <button type="submit" class="button button-primary">
                  {translate(BackofficeCopyKey.NumberPinSubmit)}
                </button>
              </form>
            ) : (
              <p>{translate(BackofficeCopyKey.NumberPinNotStored)}</p>
            )}
          </section>
          <section class="card" aria-labelledby="state-title">
            <h2 id="state-title">{translate(BackofficeCopyKey.NumberStateTitle)}</h2>
            {allowedTargets.length === 0 ? (
              <p>{translate(BackofficeCopyKey.NumberStateNoTarget)}</p>
            ) : (
              <form method="post" action={numberPath({ numberId: entry.numberId, segment: NumberSegment.State })}>
                {csrf}
                <fieldset>
                  <legend>{translate(BackofficeCopyKey.NumberStateLegend)}</legend>
                  {allowedTargets.map((target) => (
                    <label class="choice">
                      <input type="radio" name={NumberFormField.State} value={target} checked={target === selectedState} required />
                      {translate(TARGET_OPTIONS[target])}
                    </label>
                  ))}
                </fieldset>
                {allowedTargets.includes(WhatsAppNumberState.Disabled) ? (
                  <label class="choice">
                    <input type="checkbox" name={NumberFormField.ConfirmDisable} value={CHECKED_VALUE} />
                    {translate(BackofficeCopyKey.NumberStateDisabledConfirm)}
                  </label>
                ) : null}
                <CodeField locale={locale} id="state-code" />
                <button type="submit" class="button button-primary">
                  {translate(BackofficeCopyKey.NumberStateSubmit)}
                </button>
              </form>
            )}
          </section>
          <section class="card" aria-labelledby="token-title">
            <h2 id="token-title">{translate(BackofficeCopyKey.NumberRotateTokenTitle)}</h2>
            <form method="post" action={numberPath({ numberId: entry.numberId, segment: NumberSegment.AccessToken })}>
              {csrf}
              <TextField
                id="rotate-token"
                name={NumberFormField.AccessToken}
                label={translate(BackofficeCopyKey.NumberRotateTokenLabel)}
                help={null}
                value={null}
                error={null}
                isSecret
              />
              <CodeField locale={locale} id="token-code" />
              <button type="submit" class="button button-primary">
                {translate(BackofficeCopyKey.NumberRotateTokenSubmit)}
              </button>
            </form>
          </section>
        </div>
      </div>
    </Layout>
  );
}

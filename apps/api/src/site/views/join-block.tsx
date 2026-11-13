import { type WebLocale, TURNSTILE_ACTION_WAITLIST_JOIN, WAITLIST_EMAIL_MAX_LENGTH } from '@zapbip/types';
import { ShellTheme } from '../../web-shell/shell-theme';
import { NoticeVariant } from '../../backoffice/backoffice-notice';
import { type JoinFormState, JoinState, type PageModel } from '../page-model';
import { siteAgentNameOf } from '../site-agents';
import { REFERRAL_SHARING_OPEN, TURNSTILE_RESPONSE_FIELD } from '../site-constants';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { LegalDocument, legalPathOf } from '../legal-links';
import { SitePath } from '../site-paths';
import { turnstileLanguageOf } from './site-layout';
import { Notice } from './notice';
import { ReferralThanksPanel } from './referral-thanks-panel';
import { ThanksPanel } from './thanks-panel';

const TURNSTILE_THEMES: Record<ShellTheme, string> = {
  [ShellTheme.Light]: 'light',
  [ShellTheme.Dark]: 'dark',
  [ShellTheme.System]: 'auto',
};
const FORM_NOTICES: Partial<Record<JoinFormState, { variant: NoticeVariant; copyKey: SiteCopyKey }>> = {
  [JoinState.CaptchaFailed]: { variant: NoticeVariant.Error, copyKey: SiteCopyKey.JoinCaptchaFailed },
  [JoinState.RateLimited]: { variant: NoticeVariant.Warning, copyKey: SiteCopyKey.JoinRateLimited },
  [JoinState.Unavailable]: { variant: NoticeVariant.Warning, copyKey: SiteCopyKey.JoinUnavailable },
};
const EMAIL_ERROR_ID = 'join-email-error';
const CLIENT_NOTICES: { id: string; variant: NoticeVariant; copyKey: SiteCopyKey }[] = [
  { id: 'notice-captcha', variant: NoticeVariant.Error, copyKey: SiteCopyKey.JoinCaptchaFailed },
  { id: 'notice-offline', variant: NoticeVariant.Warning, copyKey: SiteCopyKey.JoinOffline },
];

function PrivacyNote(props: { locale: WebLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <p class="privacy-note">
      {translate(SiteCopyKey.PrivacyNoteShort)}{' '}
      <a href={legalPathOf({ document: LegalDocument.Privacy, locale: props.locale })}>{translate(SiteCopyKey.PrivacyNoteLink)}</a>
    </p>
  );
}

function JoinForm(props: { model: PageModel; state: JoinFormState; emailValue: string }) {
  const { model, state, emailValue } = props;
  const translate = copyOf({ locale: model.locale });
  const isInvalid = state === JoinState.InvalidEmail;
  return (
    <form class="join-form" method="post" action={SitePath.Join}>
      <label class="visually-hidden" for="join-email">
        {translate(SiteCopyKey.JoinEmailLabel)}
      </label>
      <p class="join-agent" id="join-agent" aria-live="polite" hidden={model.agent === null}>
        {model.agent === null ? null : translate(SiteCopyKey.AgentCardPicked, { agent: siteAgentNameOf({ id: model.agent }) })}
      </p>
      <div class="join-row">
        <input
          id="join-email"
          name="email"
          type="email"
          value={emailValue}
          placeholder={translate(SiteCopyKey.JoinEmailPlaceholder)}
          autocomplete="email"
          inputmode="email"
          maxlength={WAITLIST_EMAIL_MAX_LENGTH}
          spellcheck={false}
          autocapitalize="off"
          autofocus={isInvalid}
          aria-invalid={isInvalid ? 'true' : undefined}
          aria-describedby={isInvalid ? EMAIL_ERROR_ID : undefined}
          required
        />
        <button
          class="button button-primary button-arrow join-submit"
          type="submit"
          data-submitting-label={translate(SiteCopyKey.JoinSubmitting)}
        >
          <span data-label>{translate(SiteCopyKey.JoinSubmit)}</span>
        </button>
      </div>
      {isInvalid ? (
        <p class="field-error" id={EMAIL_ERROR_ID}>
          {translate(SiteCopyKey.JoinEmailInvalid)}
        </p>
      ) : null}
      <input type="hidden" name="locale" value={model.locale} />
      {model.referralCode === null ? null : <input type="hidden" name="referralCode" value={model.referralCode} />}
      <div class="turnstile-slot">
        <div
          class="cf-turnstile"
          data-sitekey={model.turnstileSiteKey}
          data-action={TURNSTILE_ACTION_WAITLIST_JOIN}
          data-theme={TURNSTILE_THEMES[model.theme]}
          data-language={turnstileLanguageOf({ locale: model.locale })}
          data-size="flexible"
          data-appearance="always"
          data-response-field-name={TURNSTILE_RESPONSE_FIELD}
        />
      </div>
      <noscript>
        <p class="join-needs-script">{translate(SiteCopyKey.JoinNeedsScript)}</p>
      </noscript>
      {CLIENT_NOTICES.map((notice) => (
        <template id={notice.id}>
          <Notice variant={notice.variant} locale={model.locale} title={null} message={translate(notice.copyKey)} />
        </template>
      ))}
    </form>
  );
}

function FormBlock(props: { model: PageModel; state: JoinFormState; emailValue: string }) {
  const { model, state } = props;
  const translate = copyOf({ locale: model.locale });
  const notice = FORM_NOTICES[state];
  return (
    <div class="join-block">
      {notice === undefined ? null : (
        <Notice variant={notice.variant} locale={model.locale} title={null} message={translate(notice.copyKey)} />
      )}
      <JoinForm {...props} />
      <PrivacyNote locale={model.locale} />
    </div>
  );
}

function PausedBlock(props: { model: PageModel }) {
  const translate = copyOf({ locale: props.model.locale });
  return (
    <div class="join-block">
      <Notice
        variant={NoticeVariant.Warning}
        locale={props.model.locale}
        title={translate(SiteCopyKey.JoinPausedTitle)}
        message={translate(SiteCopyKey.JoinPausedBody)}
      />
      <PrivacyNote locale={props.model.locale} />
    </div>
  );
}

export function JoinBlock(props: { model: PageModel }) {
  const { model } = props;
  const { join } = model;
  if (join.state === JoinState.Paused) return <PausedBlock model={model} />;
  if (join.state === JoinState.Joined && REFERRAL_SHARING_OPEN) {
    return (
      <div class="join-block">
        <ReferralThanksPanel
          locale={model.locale}
          siteOrigin={model.siteOrigin}
          referralCode={join.referralCode}
          creditedCount={join.creditedCount}
          cap={join.cap}
        />
      </div>
    );
  }
  if (join.state === JoinState.Joined) {
    return (
      <div class="join-block">
        <ThanksPanel locale={model.locale} />
      </div>
    );
  }
  return <FormBlock model={model} state={join.state} emailValue={join.emailValue} />;
}

import { GraphErrorKind } from '../../../numbers/graph-error-kind';
import { OnboardingStep } from '../../../numbers/meta-onboarding';
import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';
import { NoticeVariant } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { CodeField } from '../../components/fields';
import { Notice } from '../../components/notice';
import type { FormFlash } from '../../flash/form-flash';
import { Layout } from '../../layout';
import type { PageContext } from '../../page-context';
import { NumberFormField } from '../number-form-fields';

export type Translate = (key: BackofficeCopyKey, values?: Record<string, string>) => string;

export type ConnectNumberPageProps = {
  page: PageContext;
  action: string;
  title: BackofficeCopyKey;
  intro: BackofficeCopyKey;
  flash: Pick<FormFlash, 'failure' | 'errors' | 'onboarding'> | null;
};

const STEP_COPY: Record<OnboardingStep, BackofficeCopyKey> = {
  [OnboardingStep.Exchange]: BackofficeCopyKey.OnboardingStepExchange,
  [OnboardingStep.Inspect]: BackofficeCopyKey.OnboardingStepInspect,
  [OnboardingStep.Read]: BackofficeCopyKey.OnboardingStepRead,
  [OnboardingStep.Subscribe]: BackofficeCopyKey.OnboardingStepSubscribe,
  [OnboardingStep.Register]: BackofficeCopyKey.OnboardingStepRegister,
  [OnboardingStep.Override]: BackofficeCopyKey.OnboardingStepOverride,
};
const KIND_COPY: Record<GraphErrorKind, BackofficeCopyKey> = {
  [GraphErrorKind.Auth]: BackofficeCopyKey.OnboardingKindAuth,
  [GraphErrorKind.NotFound]: BackofficeCopyKey.OnboardingKindNotFound,
  [GraphErrorKind.Network]: BackofficeCopyKey.OnboardingKindNetwork,
  [GraphErrorKind.Upstream]: BackofficeCopyKey.OnboardingKindUpstream,
  [GraphErrorKind.CodeExpired]: BackofficeCopyKey.OnboardingKindCodeExpired,
  [GraphErrorKind.PinMismatch]: BackofficeCopyKey.OnboardingKindPinMismatch,
  [GraphErrorKind.RateLimited]: BackofficeCopyKey.OnboardingKindRateLimited,
  [GraphErrorKind.NotGranted]: BackofficeCopyKey.OnboardingKindNotGranted,
  [GraphErrorKind.WebhookClaimedElsewhere]: BackofficeCopyKey.OnboardingKindWebhookClaimedElsewhere,
};

export function failureMessagesOf(input: { flash: ConnectNumberPageProps['flash']; translate: Translate }): string[] {
  const { flash, translate } = input;
  return [
    flash === null || flash.failure === null ? null : translate(flash.failure),
    flash === null || flash.onboarding === null
      ? null
      : translate(BackofficeCopyKey.OnboardingFailed, {
          step: translate(STEP_COPY[flash.onboarding.step]),
          kind: translate(KIND_COPY[flash.onboarding.kind]),
        }),
    ...(flash === null ? [] : Object.values(flash.errors).map((key) => translate(key))),
  ].filter((message) => message !== null);
}

export function ConnectNumberPage(props: ConnectNumberPageProps) {
  const { page, flash, action, title, intro } = props;
  const { locale } = page;
  const translate: Translate = (key, values) => renderBackofficeCopy({ key, locale, values });
  const failureMessages = failureMessagesOf({ flash, translate });
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(title)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Numbers}
      notice={page.notice}
      theme={page.theme}
      returnPath={page.returnPath}
    >
      <section class="card form-card" aria-labelledby="connect-title">
        <h1 id="connect-title">{translate(title)}</h1>
        {failureMessages.map((message) => (
          <Notice variant={NoticeVariant.Error} locale={locale} message={message} />
        ))}
        <p>{translate(intro)}</p>
        <form method="post" action={action}>
          <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
          <fieldset>
            <legend>{translate(BackofficeCopyKey.ConnectConfirmLegend)}</legend>
            <CodeField locale={locale} id="connect-code" />
          </fieldset>
          <div class="form-actions">
            <a href={BackofficePath.Numbers} class="button button-secondary">
              {translate(BackofficeCopyKey.ConnectCancel)}
            </a>
            <button type="submit" class="button button-primary">
              {translate(BackofficeCopyKey.ConnectContinue)}
            </button>
          </div>
        </form>
      </section>
    </Layout>
  );
}

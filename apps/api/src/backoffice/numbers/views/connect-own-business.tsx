import { ONBOARDING_PIN_LENGTH, ONBOARDING_PIN_PATTERN } from '@zapbip/types';
import type { OwnBusinessNumber } from '../../../numbers/meta-onboarding';
import { LABEL_MAX_LENGTH } from '../../backoffice-constants';
import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';
import { NoticeVariant } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { Notice } from '../../components/notice';
import { Layout } from '../../layout';
import type { PageContext } from '../../page-context';
import { TextField } from '../components/text-field';
import { NumberFormField } from '../number-form-fields';
import { NumberSegment } from '../number-paths';
import { type ConnectNumberPageProps, type Translate, failureMessagesOf } from './connect-number';

export type OwnBusinessDiagnostic = { accountCount: number; foundCount: number; connectedCount: number; ownerLookupFailure: string | null };

export type ConnectOwnBusinessPageProps = {
  page: PageContext;
  numbers: OwnBusinessNumber[];
  flash: ConnectNumberPageProps['flash'];
  diagnostic: OwnBusinessDiagnostic | null;
};

export function ConnectOwnBusinessPage(props: ConnectOwnBusinessPageProps) {
  const { page, numbers, flash, diagnostic } = props;
  const { locale } = page;
  const translate: Translate = (key, values) => renderBackofficeCopy({ key, locale, values });
  const failureMessages = failureMessagesOf({ flash, translate });
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.ConnectOwnTitle)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Numbers}
      notice={page.notice}
      theme={page.theme}
      returnPath={page.returnPath}
    >
      <section class="card form-card" aria-labelledby="connect-own-title">
        <h1 id="connect-own-title">{translate(BackofficeCopyKey.ConnectOwnTitle)}</h1>
        {failureMessages.map((message) => (
          <Notice variant={NoticeVariant.Error} locale={locale} message={message} />
        ))}
        {numbers.length === 0 ? (
          <>
            <p>{translate(BackofficeCopyKey.ConnectOwnNoNumbers)}</p>
            {diagnostic === null ? null : (
              <>
                <p>
                  {translate(BackofficeCopyKey.ConnectOwnDiagnosticCounts, {
                    accounts: String(diagnostic.accountCount),
                    found: String(diagnostic.foundCount),
                    connected: String(diagnostic.connectedCount),
                  })}
                </p>
                {diagnostic.ownerLookupFailure === null ? null : (
                  <p>{translate(BackofficeCopyKey.ConnectOwnDiagnosticLookupFailed, { reason: diagnostic.ownerLookupFailure })}</p>
                )}
              </>
            )}
            <div class="form-actions">
              <a href={BackofficePath.Numbers} class="button button-secondary">
                {translate(BackofficeCopyKey.ConnectCancel)}
              </a>
            </div>
          </>
        ) : (
          <>
            <p>{translate(BackofficeCopyKey.ConnectOwnSelectIntro)}</p>
            <form method="post" action={`${BackofficePath.Numbers}/${NumberSegment.Connect}/${NumberSegment.Own}/${NumberSegment.Select}`}>
              <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
              <fieldset>
                <legend>{translate(BackofficeCopyKey.ConnectOwnNumbersLegend)}</legend>
                {numbers.map((number) => (
                  <label class="choice">
                    <input type="radio" name={NumberFormField.OwnNumber} value={number.phoneNumberId} required />
                    <span class="mono">{number.displayNumber}</span>
                    {number.verifiedName === null ? null : <span>{number.verifiedName}</span>}
                  </label>
                ))}
              </fieldset>
              <TextField
                id="connect-label"
                name={NumberFormField.Label}
                label={translate(BackofficeCopyKey.ConnectLabelLabel)}
                help={null}
                value={null}
                error={null}
                isRequired
                maxLength={LABEL_MAX_LENGTH}
              />
              <TextField
                id="connect-pin"
                name={NumberFormField.Pin}
                label={translate(BackofficeCopyKey.ConnectPinLabel)}
                help={translate(BackofficeCopyKey.ConnectPinHelp)}
                value={null}
                error={null}
                inputmode="numeric"
                isSecret
                pattern={ONBOARDING_PIN_PATTERN.source}
                maxLength={ONBOARDING_PIN_LENGTH}
              />
              <div class="form-actions">
                <a href={BackofficePath.Numbers} class="button button-secondary">
                  {translate(BackofficeCopyKey.ConnectCancel)}
                </a>
                <button type="submit" class="button button-primary">
                  {translate(BackofficeCopyKey.ConnectOwnSubmit)}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </Layout>
  );
}

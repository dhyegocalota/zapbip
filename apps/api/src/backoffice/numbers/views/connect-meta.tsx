import { GRAPH_API_VERSION } from '../../../adapters/whatsapp/whatsapp-constants';
import { META_APP_ID, META_LOGIN_CONFIGURATION_ID, ONBOARDING_PIN_LENGTH, ONBOARDING_PIN_PATTERN } from '@zapbip/types';
import { EMBEDDED_SIGNUP_SCRIPT_HREF } from '../../assets/embedded-signup';
import { LABEL_MAX_LENGTH } from '../../backoffice-constants';
import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';
import { BackofficePath } from '../../backoffice-paths';
import { Layout } from '../../layout';
import type { PageContext } from '../../page-context';
import { TextField } from '../components/text-field';
import { NumberFormField } from '../number-form-fields';
import { NumberSegment } from '../number-paths';

const FACEBOOK_SDK_SOURCE = 'https://connect.facebook.net/en_US/sdk.js';

export function ConnectMetaPage(props: { page: PageContext }) {
  const { page } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.ConnectMetaTitle)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Numbers}
      notice={page.notice}
      theme={page.theme}
      returnPath={page.returnPath}
    >
      <section class="card form-card" aria-labelledby="connect-meta-title">
        <h1 id="connect-meta-title">{translate(BackofficeCopyKey.ConnectMetaTitle)}</h1>
        <p>{translate(BackofficeCopyKey.ConnectMetaIntro)}</p>
        <form id="connect-form" method="post" action={`${BackofficePath.Numbers}/${NumberSegment.Connect}/${NumberSegment.Meta}`}>
          <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
          <input type="hidden" name={NumberFormField.SignupCode} value="" />
          <input type="hidden" name={NumberFormField.PhoneNumberId} value="" />
          <input type="hidden" name={NumberFormField.WabaId} value="" />
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
          <p id="connect-status" class="field-help" role="status" hidden></p>
          <div class="form-actions">
            <a href={BackofficePath.Numbers} class="button button-secondary">
              {translate(BackofficeCopyKey.ConnectCancel)}
            </a>
            <button
              type="button"
              id="connect-button"
              class="button button-primary"
              data-app-id={META_APP_ID}
              data-configuration-id={META_LOGIN_CONFIGURATION_ID}
              data-graph-version={GRAPH_API_VERSION}
              data-status-working={translate(BackofficeCopyKey.ConnectStatusWorking)}
              data-status-cancelled={translate(BackofficeCopyKey.ConnectStatusCancelled)}
              data-status-error={translate(BackofficeCopyKey.ConnectStatusError)}
              data-status-no-code={translate(BackofficeCopyKey.ConnectStatusNoCode)}
              data-status-sdk-failed={translate(BackofficeCopyKey.ConnectStatusSdkFailed)}
            >
              {translate(BackofficeCopyKey.ConnectButton)}
            </button>
          </div>
        </form>
      </section>
      <script src={EMBEDDED_SIGNUP_SCRIPT_HREF} defer></script>
      <script src={FACEBOOK_SDK_SOURCE} defer></script>
    </Layout>
  );
}

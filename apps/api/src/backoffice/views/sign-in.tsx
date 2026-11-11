import type { OwnerLocale } from '@zapbip/types';
import type { DeployEnvironment } from '../../contract/deploy-environment';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import type { BackofficeNotice } from '../backoffice-notice';
import type { BackofficeTheme } from '../backoffice-theme';
import { BackofficePath } from '../backoffice-paths';
import { CodeField, Field } from '../components/fields';
import { Layout } from '../layout';

export type SignInPageProps = {
  locale: OwnerLocale;
  theme: BackofficeTheme;
  environment: DeployEnvironment;
  csrfToken: string;
  stylesheetHref: string;
  notice: BackofficeNotice | null;
};

export function SignInPage(props: SignInPageProps) {
  const { locale } = props;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  return (
    <Layout
      locale={locale}
      environment={props.environment}
      title={translate(BackofficeCopyKey.SignInTitle)}
      stylesheetHref={props.stylesheetHref}
      csrfToken={props.csrfToken}
      signedIn={false}
      currentPath={BackofficePath.SignIn}
      notice={props.notice}
      theme={props.theme}
    >
      <section class="card form-card" aria-labelledby="sign-in-title">
        <p class="eyebrow">{translate(BackofficeCopyKey.SignInEyebrow)}</p>
        <h1 id="sign-in-title">{translate(BackofficeCopyKey.SignInTitle)}</h1>
        <p class="lead">{translate(BackofficeCopyKey.SignInLead)}</p>
        <form method="post" action={BackofficePath.SignIn}>
          <input type="hidden" name="csrf" value={props.csrfToken} />
          <Field
            id="key"
            name="key"
            type="password"
            autocomplete="current-password"
            label={translate(BackofficeCopyKey.SignInKeyLabel)}
            help={translate(BackofficeCopyKey.SignInKeyHelp)}
            autofocus
          />
          <CodeField locale={locale} id="code" />
          <button type="submit" class="button button-primary">
            {translate(BackofficeCopyKey.SignInSubmit)}
          </button>
        </form>
      </section>
    </Layout>
  );
}

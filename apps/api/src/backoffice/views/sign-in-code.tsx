import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';
import { CodeField } from '../components/fields';
import { Layout } from '../layout';
import type { SignInPageProps } from './sign-in';

export function SignInCodePage(props: SignInPageProps) {
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
      currentPath={BackofficePath.SignInCode}
      notice={props.notice}
      theme={props.theme}
      returnPath={BackofficePath.SignInCode}
    >
      <section class="card form-card" aria-labelledby="sign-in-title">
        <p class="eyebrow">{translate(BackofficeCopyKey.SignInEyebrow)}</p>
        <h1 id="sign-in-title">{translate(BackofficeCopyKey.SignInTitle)}</h1>
        <p class="lead">{translate(BackofficeCopyKey.SignInCodeLead)}</p>
        <form method="post" action={BackofficePath.SignInCode}>
          <input type="hidden" name="csrf" value={props.csrfToken} />
          <CodeField locale={locale} id="code" />
          <button type="submit" class="button button-primary">
            {translate(BackofficeCopyKey.SignInCodeSubmit)}
          </button>
        </form>
      </section>
    </Layout>
  );
}

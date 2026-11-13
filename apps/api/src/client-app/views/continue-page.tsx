import { CLIENT_APP_SIGN_IN_PATH_PREFIX, type OwnerLocale } from '@zapbip/types';
import { CSRF_FIELD } from '../client-app-constants';
import { ClientAppCopyKey, copyOf } from '../client-app-copy';
import { pathWithLocale } from '../client-app-paths';
import type { ShellTheme } from '../../web-shell/shell-theme';
import { Layout } from './layout';

export function ContinuePage(props: { locale: OwnerLocale; theme: ShellTheme; token: string; csrfToken: string; phone: string }) {
  const { locale } = props;
  const translate = copyOf({ locale });
  const path = `${CLIENT_APP_SIGN_IN_PATH_PREFIX}${props.token}`;
  return (
    <Layout locale={locale} theme={props.theme} title={translate(ClientAppCopyKey.ContinueTitle)} currentPath={path} csrfToken={null}>
      <section class="panel">
        <h1>{translate(ClientAppCopyKey.ContinueTitle)}</h1>
        <p class="lead">{translate(ClientAppCopyKey.ContinueLead)}</p>
        <p class="note">{translate(ClientAppCopyKey.ContinueAs, { phone: props.phone })}</p>
        <form method="post" action={pathWithLocale({ locale, path })}>
          <input type="hidden" name={CSRF_FIELD} value={props.csrfToken} />
          <button type="submit" class="button button-primary button-large">
            {translate(ClientAppCopyKey.ContinueButton)}
          </button>
        </form>
      </section>
    </Layout>
  );
}

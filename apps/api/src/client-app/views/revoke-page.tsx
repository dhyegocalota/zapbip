import type { OwnerLocale } from '@zapbip/types';
import { AGENT_FIELD, CONFIRM_FIELD, CONFIRM_VALUE, CSRF_FIELD } from '../client-app-constants';
import { ClientAppCopyKey, copyOf } from '../client-app-copy';
import { ClientAppPath, pathWithLocale } from '../client-app-paths';
import { Layout } from './layout';

export function RevokePage(props: { locale: OwnerLocale; agent: string; csrfToken: string }) {
  const { locale, agent } = props;
  const translate = copyOf({ locale });
  const title = translate(ClientAppCopyKey.RevokeTitle, { agent });
  return (
    <Layout locale={locale} title={title} currentPath={ClientAppPath.Home} csrfToken={props.csrfToken}>
      <section class="panel">
        <h1>{title}</h1>
        <p class="lead">{translate(ClientAppCopyKey.RevokeBody)}</p>
        <form method="post" action={pathWithLocale({ locale, path: ClientAppPath.RevokeAgent })} class="actions">
          <input type="hidden" name={CSRF_FIELD} value={props.csrfToken} />
          <input type="hidden" name={AGENT_FIELD} value={agent} />
          <input type="hidden" name={CONFIRM_FIELD} value={CONFIRM_VALUE} />
          <button type="submit" class="button button-danger">
            {translate(ClientAppCopyKey.RevokeConfirm)}
          </button>
          <a class="button button-secondary" href={pathWithLocale({ locale, path: ClientAppPath.Home })}>
            {translate(ClientAppCopyKey.RevokeCancel)}
          </a>
        </form>
      </section>
    </Layout>
  );
}

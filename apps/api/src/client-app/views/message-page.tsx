import type { OwnerLocale } from '@zapbip/types';
import { ClientAppCopyKey, copyOf } from '../client-app-copy';
import { ClientAppPath, pathWithLocale } from '../client-app-paths';
import { Layout } from './layout';

export type MessagePageProps = {
  locale: OwnerLocale;
  title: ClientAppCopyKey;
  body: ClientAppCopyKey;
  currentPath: string;
  csrfToken: string | null;
};

export function MessagePage(props: MessagePageProps) {
  const { locale } = props;
  const translate = copyOf({ locale });
  return (
    <Layout locale={locale} title={translate(props.title)} currentPath={props.currentPath} csrfToken={props.csrfToken}>
      <section class="panel">
        <h1>{translate(props.title)}</h1>
        <p>{translate(props.body)}</p>
        <a class="button button-primary" href={pathWithLocale({ locale, path: ClientAppPath.Home })}>
          {translate(ClientAppCopyKey.BackHome)}
        </a>
      </section>
    </Layout>
  );
}

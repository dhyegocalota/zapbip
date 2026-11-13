import type { OwnerLocale } from '@zapbip/types';
import { ClientAppCopyKey, copyOf } from '../client-app-copy';
import { ClientAppPath } from '../client-app-paths';
import { Layout } from './layout';

export function SignedOutPage(props: { locale: OwnerLocale; whatsappHref: string }) {
  const { locale } = props;
  const translate = copyOf({ locale });
  return (
    <Layout locale={locale} title={translate(ClientAppCopyKey.SignedOutTitle)} currentPath={ClientAppPath.Home} csrfToken={null}>
      <section class="panel">
        <h1>{translate(ClientAppCopyKey.SignedOutTitle)}</h1>
        <p class="lead">{translate(ClientAppCopyKey.SignedOutLead)}</p>
        <a class="button button-primary button-large" href={props.whatsappHref}>
          {translate(ClientAppCopyKey.SignInWithWhatsapp)}
        </a>
        <p class="note">{translate(ClientAppCopyKey.SignedOutNote)}</p>
      </section>
    </Layout>
  );
}

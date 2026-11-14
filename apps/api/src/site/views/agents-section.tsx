import type { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { SitePath } from '../site-paths';

export function AgentsSection(props: { locale: OwnerLocale; siteOrigin: string }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="block" id="agents" aria-labelledby="agents-title">
      <div class="container">
        <h2 class="section-title reveal" id="agents-title">
          {translate(SiteCopyKey.AgentsTitle)}
        </h2>
        <p class="lead reveal">{translate(SiteCopyKey.AgentsBody, { endpoint: `${props.siteOrigin}${SitePath.RequestAccess}` })}</p>
      </div>
    </section>
  );
}

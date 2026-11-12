import type { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { siteAgentNames } from '../site-agents';

export function ClientsSection(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="block" id="clients" aria-labelledby="clients-title">
      <div class="container">
        <p class="eyebrow">{translate(SiteCopyKey.ClientsEyebrow)}</p>
        <h2 class="section-title" id="clients-title">
          {translate(SiteCopyKey.ClientsTitle)}
        </h2>
        <div class="clients">
          {siteAgentNames().map((name) => (
            <div class="card client">
              <strong>{name}</strong>
            </div>
          ))}
          <div class="card client hero-card">
            <strong>{translate(SiteCopyKey.ClientsAnyMcpName)}</strong>
            <span>{translate(SiteCopyKey.ClientsAnyMcp)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

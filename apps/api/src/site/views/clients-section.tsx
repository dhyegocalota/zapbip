import type { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { siteAgentsOf } from '../site-agents';

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
          {siteAgentsOf({ locale: props.locale }).map((agent) => (
            <div class="card client">
              <strong>{agent.name}</strong>
              <span>{translate(agent.chipKey, agent.seconds === null ? undefined : { seconds: agent.seconds })}</span>
            </div>
          ))}
        </div>
        <p class="footnote">{translate(SiteCopyKey.ClientsFootnote)}</p>
      </div>
    </section>
  );
}

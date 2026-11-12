import type { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { initialsOf, siteAgents } from '../site-agents';
import { agentPathOf, joinPathOf, languageOf } from '../site-links';

const ANY_BADGE = '+';

export function ClientsSection(props: { locale: OwnerLocale; referralCode: string | null }) {
  const translate = copyOf({ locale: props.locale });
  const language = languageOf({ locale: props.locale });
  return (
    <section class="block" id="clients" aria-labelledby="clients-title">
      <div class="container">
        <p class="eyebrow reveal">{translate(SiteCopyKey.ClientsEyebrow)}</p>
        <h2 class="section-title reveal" id="clients-title">
          {translate(SiteCopyKey.ClientsTitle)}
        </h2>
        <p class="lead reveal">{translate(SiteCopyKey.ClientsLead)}</p>
        <div class="clients">
          {siteAgents().map((agent) => (
            <article class="card agent-card reveal">
              <span class="agent-badge" aria-hidden="true">
                {initialsOf({ name: agent.name })}
              </span>
              <h3 class="agent-name">{agent.name}</h3>
              <a
                class="agent-pick"
                href={agentPathOf({ agent: agent.id, language, referralCode: props.referralCode })}
                data-picked-label={translate(SiteCopyKey.AgentCardPicked, { agent: agent.name })}
                aria-label={translate(SiteCopyKey.AgentCardButton, { agent: agent.name })}
              >
                {translate(SiteCopyKey.AgentCardShort)}
              </a>
            </article>
          ))}
          <article class="card agent-card agent-card-any hero-card reveal">
            <span class="agent-badge" aria-hidden="true">
              {ANY_BADGE}
            </span>
            <h3 class="agent-name">{translate(SiteCopyKey.ClientsAnyMcpName)}</h3>
            <span class="agent-tag">{translate(SiteCopyKey.ClientsAnyMcp)}</span>
            <a class="button button-primary" href={joinPathOf({ language, referralCode: props.referralCode })} data-clear-agent>
              {translate(SiteCopyKey.ClientsAnyMcpButton)}
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

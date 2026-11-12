import { McpToolName, type OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { siteAgents } from '../site-agents';
import { agentPathOf } from '../site-links';

const PROMPT_GLYPH = '$';
const AGENT_SNIPPET = `${McpToolName.Ask}(question)`;
const JOIN_FRAGMENT = '#join';

export function ClientsSection(props: { locale: OwnerLocale; referralCode: string | null }) {
  const translate = copyOf({ locale: props.locale });
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
              <h3 class="agent-name">{agent.name}</h3>
              <p>{translate(SiteCopyKey.AgentCardLine, { agent: agent.name })}</p>
              <code class="agent-snippet" aria-hidden="true">
                <span class="accent">{PROMPT_GLYPH}</span> {AGENT_SNIPPET}
              </code>
              <a
                class="button button-secondary agent-pick"
                href={agentPathOf({ agent: agent.id, referralCode: props.referralCode })}
                data-picked-label={translate(SiteCopyKey.AgentCardPicked, { agent: agent.name })}
              >
                {translate(SiteCopyKey.AgentCardButton, { agent: agent.name })}
              </a>
            </article>
          ))}
          <article class="card agent-card agent-card-any hero-card reveal">
            <h3 class="agent-name">{translate(SiteCopyKey.ClientsAnyMcpName)}</h3>
            <p>{translate(SiteCopyKey.ClientsAnyMcp)}</p>
            <code class="agent-snippet" aria-hidden="true">
              <span class="accent">{PROMPT_GLYPH}</span> {AGENT_SNIPPET}
            </code>
            <a class="button button-primary agent-pick" href={JOIN_FRAGMENT}>
              {translate(SiteCopyKey.ClientsAnyMcpButton)}
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

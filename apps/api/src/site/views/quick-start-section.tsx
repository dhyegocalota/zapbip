import type { InstallClient } from '@zapbip/agents/install';
import type { OwnerLocale } from '@zapbip/types';
import { CodeTokenKind, highlightCode } from '../code-tokens';
import { initialsOf, siteAgents, SiteStartTab, siteQuickStartOf } from '../site-agents';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { agentPathOf, joinPathOf, startPathOf } from '../site-links';
import { SITE_EXAMPLE_CONNECTION_LINK } from '../site-constants';
import { logoPathOf } from '../site-paths';

const ANY_BADGE = '+';
const LOGO_SIZE = 20;
const LINE_BREAK = '\n';
const ANY_PATH_KEYS = [SiteCopyKey.StartAnyStepOpen, SiteCopyKey.StartAnyStepAdd, SiteCopyKey.StartAnyStepPaste];
const HIGHLIGHTED_KINDS = [
  CodeTokenKind.Command,
  CodeTokenKind.Flag,
  CodeTokenKind.Key,
  CodeTokenKind.String,
  CodeTokenKind.Table,
  CodeTokenKind.Placeholder,
  CodeTokenKind.Url,
];

type Tab = {
  id: InstallClient | SiteStartTab;
  agent: InstallClient | null;
  name: string;
  logoId: string | null;
  initials: string;
  hint: string;
  path: string[];
  code: string;
  pickedLabel: string | null;
};

function CodeText(props: { code: string }) {
  return (
    <>
      {highlightCode({ code: props.code }).map((line, index) => (
        <>
          {index === 0 ? null : LINE_BREAK}
          <span class="code-line">
            {line.map((token) =>
              HIGHLIGHTED_KINDS.includes(token.kind) ? <span class={`tok-${token.kind}`}>{token.text}</span> : token.text,
            )}
          </span>
        </>
      ))}
    </>
  );
}

function TabLogo(props: { tab: Tab }) {
  const { tab } = props;
  if (tab.logoId === null) {
    return (
      <span class="agent-badge" aria-hidden="true">
        {tab.initials}
      </span>
    );
  }
  return (
    <span class="start-logo">
      <img
        class="start-logo-image"
        src={logoPathOf({ id: tab.logoId })}
        alt=""
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

export function QuickStartSection(props: { locale: OwnerLocale; referralCode: string | null; startTab: InstallClient | SiteStartTab }) {
  const { locale, referralCode, startTab } = props;
  const translate = copyOf({ locale });
  const agentTabs: Tab[] = siteAgents().map((agent) => {
    const quickStart = siteQuickStartOf({ id: agent.id, locale, connectionLink: SITE_EXAMPLE_CONNECTION_LINK });
    return {
      id: agent.id,
      agent: agent.id,
      name: agent.name,
      logoId: agent.logo,
      initials: initialsOf({ name: agent.name }),
      ...quickStart,
      pickedLabel: translate(SiteCopyKey.AgentCardPicked, { agent: agent.name }),
    };
  });
  const anyTab: Tab = {
    id: SiteStartTab.AnyMcp,
    agent: null,
    name: translate(SiteCopyKey.ClientsAnyMcpName),
    logoId: null,
    initials: ANY_BADGE,
    hint: translate(SiteCopyKey.StartAnyHint),
    path: ANY_PATH_KEYS.map((key) => translate(key)),
    code: SITE_EXAMPLE_CONNECTION_LINK,
    pickedLabel: null,
  };
  const tabs = [...agentTabs, anyTab];
  return (
    <section class="block" id="start" aria-labelledby="start-title">
      <div class="container">
        <p class="eyebrow reveal">{translate(SiteCopyKey.ClientsEyebrow)}</p>
        <h2 class="section-title reveal" id="start-title">
          {translate(SiteCopyKey.StartTitle)}
        </h2>
        <p class="lead reveal">{translate(SiteCopyKey.StartLead)}</p>
        <div class="start-tabs reveal" role="tablist" aria-label={translate(SiteCopyKey.StartTablistLabel)}>
          {tabs.map((tab) => (
            <a
              class="start-tab"
              role="tab"
              id={`start-tab-${tab.id}`}
              href={startPathOf({ tab: tab.id, locale, referralCode })}
              aria-selected={String(tab.id === startTab)}
              aria-controls={`start-panel-${tab.id}`}
            >
              <TabLogo tab={tab} />
              <span class="start-tab-name">{tab.name}</span>
            </a>
          ))}
        </div>
        {tabs.map((tab) => (
          <div
            class="start-panel"
            role="tabpanel"
            id={`start-panel-${tab.id}`}
            aria-labelledby={`start-tab-${tab.id}`}
            hidden={tab.id !== startTab}
          >
            <div class="code-window">
              <div class="code-bar">
                <span class="code-hint">{tab.hint}</span>
                <button
                  class="start-copy"
                  type="button"
                  hidden
                  data-copied-label={translate(SiteCopyKey.StartCopied)}
                  data-copied-announcement={translate(SiteCopyKey.StartCopiedAnnouncement)}
                  data-fallback-announcement={translate(SiteCopyKey.StartCopyFallback)}
                >
                  {translate(SiteCopyKey.StartCopy)}
                </button>
              </div>
              {tab.path.length === 0 ? null : (
                <ol class="code-path">
                  {tab.path.map((step) => (
                    <li>{step}</li>
                  ))}
                </ol>
              )}
              <pre class="code-block">
                <code class={`code-lines-${tab.code.split(LINE_BREAK).length}`} data-code={tab.code}>
                  <CodeText code={tab.code} />
                </code>
              </pre>
              <p class="start-example">{translate(SiteCopyKey.StartExampleCaption)}</p>
            </div>
            <div class="start-next">
              {tab.agent === null ? (
                <a class="button button-primary start-cta" href={joinPathOf({ locale, referralCode })} data-clear-agent>
                  {translate(SiteCopyKey.StartCta)}
                </a>
              ) : (
                <a
                  class="button button-primary start-cta"
                  href={agentPathOf({ agent: tab.agent, locale, referralCode })}
                  data-picked-label={tab.pickedLabel}
                >
                  {translate(SiteCopyKey.StartCta)}
                </a>
              )}
              <p class="start-note">{translate(SiteCopyKey.StartNote)}</p>
            </div>
          </div>
        ))}
        <p class="visually-hidden" id="start-announcement" aria-live="polite" />
      </div>
    </section>
  );
}

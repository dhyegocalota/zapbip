import { AccountState, WebLocale } from '@zapbip/types';
import { AGENT_NAME_MAX_CHARS } from '@zapbip/core';
import { AGENT_FIELD, AGENT_NAME_FIELD, CSRF_FIELD, DELETE_ACCOUNT_DOCS_PATH } from '../client-app-constants';
import { ClientAppCopyKey, copyOf } from '../client-app-copy';
import { ClientAppPath, pathWithLocale } from '../client-app-paths';
import type { ShellTheme } from '../../web-shell/shell-theme';
import { docsUrlOf } from '../../web-shell/shell-links';
import { Layout } from './layout';
import { pricingValuesOf } from '../../site/price-format';

export type AgentRow = { agent: string; clientName: string | null; addedOn: string; lastActiveOn: string | null };

export type HomePageProps = {
  locale: WebLocale;
  theme: ShellTheme;
  state: AccountState;
  csrfToken: string;
  phone: string;
  agents: AgentRow[];
  noticeKey: ClientAppCopyKey | null;
  problem: string | null;
  createdAgent: { agent: string; installPrompt: string } | null;
};

const DETAIL_SEPARATOR = ' · ';

function detailsOf(input: { row: AgentRow; translate: ReturnType<typeof copyOf> }): string[] {
  const { row, translate } = input;
  return [
    ...(row.clientName === null ? [] : [`${translate(ClientAppCopyKey.AgentClient)}: ${row.clientName}`]),
    translate(ClientAppCopyKey.AgentAdded, { date: row.addedOn }),
    ...(row.lastActiveOn === null ? [] : [translate(ClientAppCopyKey.AgentLastActive, { date: row.lastActiveOn })]),
  ];
}

function Waitlist(props: { locale: WebLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="panel">
      <h1>{translate(ClientAppCopyKey.WaitlistTitle)}</h1>
      <p class="lead">{translate(ClientAppCopyKey.WaitlistBody)}</p>
    </section>
  );
}

function AgentList(props: HomePageProps) {
  const { locale, csrfToken } = props;
  const translate = copyOf({ locale });
  if (props.agents.length === 0) return <p class="note">{translate(ClientAppCopyKey.AgentsEmpty)}</p>;
  return (
    <ul class="agent-list">
      {props.agents.map((row) => (
        <li class="agent-row">
          <div class="agent-details">
            <strong class="agent-name">{row.agent}</strong>
            <span class="note">{detailsOf({ row, translate }).join(DETAIL_SEPARATOR)}</span>
          </div>
          <form method="post" action={pathWithLocale({ locale, path: ClientAppPath.RevokeAgent })}>
            <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
            <input type="hidden" name={AGENT_FIELD} value={row.agent} />
            <button type="submit" class="button button-secondary">
              {translate(ClientAppCopyKey.Revoke)}
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

function CreatedAgent(props: { locale: WebLocale; created: NonNullable<HomePageProps['createdAgent']> }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="panel panel-success" aria-live="polite">
      <h2>{translate(ClientAppCopyKey.AgentCreated, { agent: props.created.agent })}</h2>
      <pre class="prompt">{props.created.installPrompt}</pre>
      <p class="note">{translate(ClientAppCopyKey.AgentCreatedHint)}</p>
    </section>
  );
}

function ConnectForm(props: { locale: WebLocale; csrfToken: string; problem: string | null }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="panel">
      <h2>{translate(ClientAppCopyKey.ConnectTitle)}</h2>
      <form method="post" action={pathWithLocale({ locale: props.locale, path: ClientAppPath.Agents })} class="connect-form">
        <input type="hidden" name={CSRF_FIELD} value={props.csrfToken} />
        <label for="agent-name">{translate(ClientAppCopyKey.ConnectLabel)}</label>
        <input
          id="agent-name"
          name={AGENT_NAME_FIELD}
          type="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          maxlength={AGENT_NAME_MAX_CHARS}
        />
        <p class="note">{translate(ClientAppCopyKey.ConnectHint)}</p>
        {props.problem === null ? null : (
          <p class="problem" role="alert">
            {props.problem}
          </p>
        )}
        <button type="submit" class="button button-primary">
          {translate(ClientAppCopyKey.ConnectButton)}
        </button>
      </form>
    </section>
  );
}

function Account(props: { locale: WebLocale; phone: string }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="panel">
      <h2>{translate(ClientAppCopyKey.AccountTitle)}</h2>
      <p class="plan">{translate(ClientAppCopyKey.PlanLine, { free: pricingValuesOf({ locale: props.locale }).free })}</p>
      <p class="note">{translate(ClientAppCopyKey.SignedInAs, { phone: props.phone })}</p>
      <p class="note">{translate(ClientAppCopyKey.DeleteAccountHint)}</p>
      <a class="button button-secondary" href={docsUrlOf({ locale: props.locale, path: DELETE_ACCOUNT_DOCS_PATH })}>
        {translate(ClientAppCopyKey.DeleteAccount)}
      </a>
    </section>
  );
}

export function HomePage(props: HomePageProps) {
  const { locale } = props;
  const translate = copyOf({ locale });
  const isWaitlisted = props.state === AccountState.Waitlisted;
  const title = translate(isWaitlisted ? ClientAppCopyKey.WaitlistTitle : ClientAppCopyKey.AgentsTitle);
  return (
    <Layout locale={locale} theme={props.theme} title={title} currentPath={ClientAppPath.Home} csrfToken={props.csrfToken}>
      {props.noticeKey === null ? null : (
        <p class="notice" role="status">
          {translate(props.noticeKey)}
        </p>
      )}
      {isWaitlisted ? (
        <Waitlist locale={locale} />
      ) : (
        <>
          <section class="panel">
            <h1>{translate(ClientAppCopyKey.AgentsTitle)}</h1>
            <AgentList {...props} />
          </section>
          {props.createdAgent === null ? null : <CreatedAgent locale={locale} created={props.createdAgent} />}
          <ConnectForm locale={locale} csrfToken={props.csrfToken} problem={props.problem} />
          <Account locale={locale} phone={props.phone} />
        </>
      )}
    </Layout>
  );
}

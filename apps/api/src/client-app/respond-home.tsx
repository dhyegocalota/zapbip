import { HttpStatus } from '@zapbip/types';
import { buildAccountOverview, type AccountOverview, type AgentSummary } from '@zapbip/core';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { D1ConnectionRegistry } from '../adapters/d1/d1-connection-registry';
import type { AccountOwnerRpc } from '../contract/account-owner-rpc';
import { accountInboxOf } from '../routes/account-inbox-stub';
import { ISO_DATE_LENGTH } from './client-app-constants';
import type { ClientAppEnv, ClientAppSession } from './client-app-env';
import { HomePage, type AgentRow, type HomePageProps } from './views/home-page';

type HomeExtras = Pick<HomePageProps, 'noticeKey' | 'problem' | 'createdAgent'>;

const NO_EXTRAS: HomeExtras = { noticeKey: null, problem: null, createdAgent: null };

function dayOf(input: { timestamp: number }): string {
  return new Date(input.timestamp).toISOString().slice(0, ISO_DATE_LENGTH);
}

function rowOf(input: { summary: AgentSummary }): AgentRow {
  const { summary } = input;
  return {
    agent: summary.agent,
    clientName: summary.clientName,
    addedOn: dayOf({ timestamp: summary.createdAt }),
    lastActiveOn: summary.lastSeenAt === null ? null : dayOf({ timestamp: summary.lastSeenAt }),
  };
}

export async function overviewOf(input: { context: Context<ClientAppEnv>; session: ClientAppSession }): Promise<AccountOverview> {
  const { context, session } = input;
  const connections = await new D1ConnectionRegistry({ database: context.env.CONNECTIONS }).listActive({ accountId: session.accountId });
  const activity = await accountInboxOf<AccountOwnerRpc>({ bindings: context.env, accountId: session.accountId }).listAgentActivity();
  return buildAccountOverview({ account: session, connections, activity });
}

export async function respondHome(input: {
  context: Context<ClientAppEnv>;
  session: ClientAppSession;
  status: HttpStatus;
  extras?: Partial<HomeExtras>;
}): Promise<Response> {
  const { context, session, status, extras = {} } = input;
  const locale = context.get('locale');
  const overview = await overviewOf({ context, session });
  const page = (
    <HomePage
      {...NO_EXTRAS}
      {...extras}
      locale={locale}
      state={session.state}
      csrfToken={session.csrfToken}
      phone={overview.phone}
      agents={overview.agents.map((summary) => rowOf({ summary }))}
    />
  );
  return context.html(page, status as ContentfulStatusCode);
}

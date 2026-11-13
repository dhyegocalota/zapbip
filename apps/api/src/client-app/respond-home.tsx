import { HttpStatus } from '@zapbip/types';
import type { ConnectionRecord } from '@zapbip/core';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { D1ConnectionRegistry } from '../adapters/d1/d1-connection-registry';
import type { AccountOwnerRpc } from '../contract/account-owner-rpc';
import { accountInboxOf } from '../routes/account-inbox-stub';
import { maskedPhoneOf } from './masked-phone';
import { ISO_DATE_LENGTH } from './client-app-constants';
import type { ClientAppEnv, ClientAppSession } from './client-app-env';
import { HomePage, type AgentRow, type HomePageProps } from './views/home-page';

type HomeExtras = Pick<HomePageProps, 'noticeKey' | 'problem' | 'createdAgent'>;

const NO_EXTRAS: HomeExtras = { noticeKey: null, problem: null, createdAgent: null };

function dayOf(input: { timestamp: number }): string {
  return new Date(input.timestamp).toISOString().slice(0, ISO_DATE_LENGTH);
}

function rowOf(input: { connection: ConnectionRecord; lastSeenAt: Map<string, number> }): AgentRow {
  const { connection, lastSeenAt } = input;
  const seenAt = lastSeenAt.get(connection.agent);
  return {
    agent: connection.agent,
    clientName: connection.clientName,
    addedOn: dayOf({ timestamp: connection.createdAt }),
    lastActiveOn: seenAt === undefined ? null : dayOf({ timestamp: seenAt }),
  };
}

export async function respondHome(input: {
  context: Context<ClientAppEnv>;
  session: ClientAppSession;
  status: HttpStatus;
  extras?: Partial<HomeExtras>;
}): Promise<Response> {
  const { context, session, status, extras = {} } = input;
  const locale = context.get('locale');
  const connections = await new D1ConnectionRegistry({ database: context.env.CONNECTIONS }).listActive({ accountId: session.accountId });
  const activity = await accountInboxOf<AccountOwnerRpc>({ bindings: context.env, accountId: session.accountId }).listAgentActivity();
  const lastSeenAt = new Map(activity.map((entry) => [entry.agent, entry.lastSeenAt]));
  const page = (
    <HomePage
      {...NO_EXTRAS}
      {...extras}
      locale={locale}
      state={session.state}
      csrfToken={session.csrfToken}
      phone={maskedPhoneOf({ waId: session.waId })}
      agents={connections.map((connection) => rowOf({ connection, lastSeenAt }))}
    />
  );
  return context.html(page, status as ContentfulStatusCode);
}

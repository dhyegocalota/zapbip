import { HttpStatus, type OwnerLocale } from '@zapbip/types';
import { UNKNOWN_CLIENT_LABEL, type ConnectionRecord } from '@zapbip/core';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { D1ConnectionRegistry } from '../adapters/d1/d1-connection-registry';
import { ISO_DATE_LENGTH } from './client-app-constants';
import type { ClientAppEnv, ClientAppSession } from './client-app-env';
import { HomePage, type AgentRow, type HomePageProps } from './views/home-page';

type HomeExtras = Pick<HomePageProps, 'noticeKey' | 'problem' | 'createdAgent'>;

const NO_EXTRAS: HomeExtras = { noticeKey: null, problem: null, createdAgent: null };

function rowOf(input: { connection: ConnectionRecord; locale: OwnerLocale }): AgentRow {
  const { connection, locale } = input;
  return {
    agent: connection.agent,
    clientName: connection.clientName === null ? UNKNOWN_CLIENT_LABEL[locale] : connection.clientName,
    addedOn: new Date(connection.createdAt).toISOString().slice(0, ISO_DATE_LENGTH),
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
  const page = (
    <HomePage
      {...NO_EXTRAS}
      {...extras}
      locale={locale}
      state={session.state}
      csrfToken={session.csrfToken}
      agents={connections.map((connection) => rowOf({ connection, locale }))}
    />
  );
  return context.html(page, status as ContentfulStatusCode);
}

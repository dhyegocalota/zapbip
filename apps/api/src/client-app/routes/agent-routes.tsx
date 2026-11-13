import { AGENTS_PER_ACCOUNT_LIMIT, type AccountReply, type AccountCommandResult } from '@zapbip/core';
import { AccountReplyIntent, AccountReplyParameter, CommandKind, HttpStatus } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { SEE_OTHER_STATUS } from '../../backoffice/backoffice-constants';
import { textFieldOf } from '../../backoffice/form-fields';
import type { AccountOwnerRpc, WebCommandKind } from '../../contract/account-owner-rpc';
import { accountInboxOf } from '../../routes/account-inbox-stub';
import { AGENT_FIELD, AGENT_NAME_FIELD, CONFIRM_FIELD, CONFIRM_VALUE, ClientAppNotice, NOTICE_PARAMETER } from '../client-app-constants';
import { ClientAppCopyKey, renderClientAppCopy } from '../client-app-copy';
import type { ClientAppEnv, ClientAppSession } from '../client-app-env';
import { ClientAppPath, pathWithLocale } from '../client-app-paths';
import { respondHome } from '../respond-home';
import { activeSubmission } from '../session-guards';
import { RevokePage } from '../views/revoke-page';

const CREATE_PROBLEMS: Partial<Record<AccountReplyIntent, ClientAppCopyKey>> = {
  [AccountReplyIntent.Usage]: ClientAppCopyKey.ProblemEmptyName,
  [AccountReplyIntent.InvalidName]: ClientAppCopyKey.ProblemInvalidName,
  [AccountReplyIntent.ReservedName]: ClientAppCopyKey.ProblemReservedName,
  [AccountReplyIntent.NameTaken]: ClientAppCopyKey.ProblemNameTaken,
  [AccountReplyIntent.LimitReached]: ClientAppCopyKey.ProblemLimitReached,
};
const REVOKE_NOTICES: Partial<Record<AccountReplyIntent, ClientAppNotice>> = {
  [AccountReplyIntent.Revoked]: ClientAppNotice.Revoked,
  [AccountReplyIntent.NotFound]: ClientAppNotice.AgentMissing,
};

async function applyWebCommand(input: {
  context: Context<ClientAppEnv>;
  session: ClientAppSession;
  kind: WebCommandKind;
  rawName: string;
}): Promise<AccountReply> {
  const { context, session, kind, rawName } = input;
  const { accountId, waId, state } = session;
  const locale = context.get('locale');
  const outcome = await accountInboxOf<AccountOwnerRpc>({ bindings: context.env, accountId }).applyWebCommand({
    account: { accountId, waId, state, locale },
    command: { kind, rawName, locale },
    publicOrigin: context.env.PUBLIC_ORIGIN,
    appOrigin: context.env.APP_ORIGIN,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  return firstReplyOf({ result: outcome.value });
}

function firstReplyOf(input: { result: AccountCommandResult }): AccountReply {
  const [reply] = input.result.replies;
  if (reply === undefined) throw new Error('the web command produced no reply');
  return reply;
}

function respondProblem(input: { context: Context<ClientAppEnv>; session: ClientAppSession; key: ClientAppCopyKey }): Promise<Response> {
  const { context, session, key } = input;
  const problem = renderClientAppCopy({ key, locale: context.get('locale'), values: { limit: String(AGENTS_PER_ACCOUNT_LIMIT) } });
  return respondHome({ context, session, status: HttpStatus.UnprocessableEntity, extras: { problem } });
}

async function connectAgent(input: { context: Context<ClientAppEnv>; session: ClientAppSession }): Promise<Response> {
  const { context, session } = input;
  const rawName = textFieldOf({ form: await context.req.parseBody(), name: AGENT_NAME_FIELD });
  if (rawName === null) return respondProblem({ context, session, key: ClientAppCopyKey.ProblemEmptyName });
  const reply = await applyWebCommand({ context, session, kind: CommandKind.CreateAgent, rawName });
  const problemKey = CREATE_PROBLEMS[reply.intent];
  if (problemKey !== undefined) return respondProblem({ context, session, key: problemKey });
  const agent = reply.parameters[AccountReplyParameter.AgentName];
  const installPrompt = reply.parameters[AccountReplyParameter.InstallPrompt];
  if (reply.intent !== AccountReplyIntent.Created || agent === undefined || installPrompt === undefined)
    throw new Error(`unexpected create reply: ${reply.intent}`);
  return respondHome({ context, session, status: HttpStatus.Ok, extras: { createdAgent: { agent, installPrompt } } });
}

async function revokeAgent(input: { context: Context<ClientAppEnv>; session: ClientAppSession }): Promise<Response> {
  const { context, session } = input;
  const locale = context.get('locale');
  const home = pathWithLocale({ locale, path: ClientAppPath.Home });
  const form = await context.req.parseBody();
  const agent = textFieldOf({ form, name: AGENT_FIELD });
  if (agent === null) return context.redirect(home, SEE_OTHER_STATUS);
  const isConfirmed = textFieldOf({ form, name: CONFIRM_FIELD }) === CONFIRM_VALUE;
  if (!isConfirmed) return context.html(<RevokePage locale={locale} agent={agent} csrfToken={session.csrfToken} />);
  const reply = await applyWebCommand({ context, session, kind: CommandKind.RevokeAgent, rawName: agent });
  const notice = REVOKE_NOTICES[reply.intent];
  if (notice === undefined) throw new Error(`unexpected revoke reply: ${reply.intent}`);
  return context.redirect(`${home}?${NOTICE_PARAMETER}=${notice}`, SEE_OTHER_STATUS);
}

export function agentRoutes(): Hono<ClientAppEnv> {
  const routes = new Hono<ClientAppEnv>();
  routes.post(ClientAppPath.Agents, activeSubmission(connectAgent));
  routes.post(ClientAppPath.RevokeAgent, activeSubmission(revokeAgent));
  return routes;
}

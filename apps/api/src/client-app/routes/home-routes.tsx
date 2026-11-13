import { CLIENT_APP_LOGIN_TEXT, HttpStatus, OWNER_LOCALE_OF_WEB_LOCALE } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { numberRegistryOf } from '../../adapters/d1/d1-number-registry';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { whatsappLinkTarget } from '../../routes/start-link-target';
import { ClientAppNotice, NOTICE_PARAMETER } from '../client-app-constants';
import { ClientAppCopyKey } from '../client-app-copy';
import type { ClientAppEnv } from '../client-app-env';
import { ClientAppPath } from '../client-app-paths';
import { respondHome } from '../respond-home';
import { respondMessage } from '../respond';
import { SignedOutPage } from '../views/signed-out-page';

const NOTICE_COPY_KEYS: Record<ClientAppNotice, ClientAppCopyKey> = {
  [ClientAppNotice.Revoked]: ClientAppCopyKey.NoticeRevoked,
  [ClientAppNotice.AgentMissing]: ClientAppCopyKey.NoticeAgentMissing,
};
const NOTICES: string[] = Object.values(ClientAppNotice);

function noticeKeyOf(input: { context: Context<ClientAppEnv> }): ClientAppCopyKey | null {
  const notice = input.context.req.query(NOTICE_PARAMETER);
  if (notice === undefined || !NOTICES.includes(notice)) return null;
  return NOTICE_COPY_KEYS[notice as ClientAppNotice];
}

function respondUnavailable(input: { context: Context<ClientAppEnv> }): Response | Promise<Response> {
  return respondMessage({
    context: input.context,
    status: HttpStatus.ServiceUnavailable,
    title: ClientAppCopyKey.UnavailableTitle,
    body: ClientAppCopyKey.UnavailableBody,
  });
}

async function respondSignedOut(input: { context: Context<ClientAppEnv> }): Promise<Response> {
  const { context } = input;
  const locale = context.get('locale');
  const displayNumber = await numberRegistryOf({ bindings: context.env }).findStartDisplayNumber();
  if (displayNumber === null) return respondUnavailable({ context });
  const whatsappHref = whatsappLinkTarget({ displayNumber, text: CLIENT_APP_LOGIN_TEXT[OWNER_LOCALE_OF_WEB_LOCALE[locale]] });
  if (whatsappHref === null) {
    logEvent({ event: LogEvent.StartLinkInvalidNumber });
    return respondUnavailable({ context });
  }
  return context.html(<SignedOutPage locale={locale} theme={context.get('theme')} whatsappHref={whatsappHref} />);
}

function showHome(context: Context<ClientAppEnv>): Promise<Response> {
  const session = context.get('session');
  if (session === null) return respondSignedOut({ context });
  return respondHome({ context, session, status: HttpStatus.Ok, extras: { noticeKey: noticeKeyOf({ context }) } });
}

export function homeRoutes(): Hono<ClientAppEnv> {
  const routes = new Hono<ClientAppEnv>();
  routes.get(ClientAppPath.Home, showHome);
  return routes;
}

import { CONNECTOR_PATH_SUFFIX } from '@zapbip/types';
import { Hono } from 'hono';
import { CONNECTOR_AGENT_PARAMETER, CONNECTOR_DIGEST_PARAMETER, CONNECTOR_OBJECT_ORIGIN } from '../account-inbox/constants';
import type { AccountInboxRpc } from '../contract/account-inbox-rpc';
import { UNAUTHORIZED_BODY } from '../contract/constants';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { resolveConnection } from './resolve-connection';
import { accountInboxOf } from './account-inbox-stub';
import { HttpStatus } from './http-status';

const WEBSOCKET_UPGRADE = 'websocket';
const UPGRADE_HEADER = 'Upgrade';

type ConnectorObject = AccountInboxRpc & Pick<DurableObjectStub, 'fetch'>;

export const connectorRoutes = new Hono<{ Bindings: Bindings }>();

connectorRoutes.get(`/c/:secret${CONNECTOR_PATH_SUFFIX}`, async (context) => {
  const resolved = await resolveConnection({ database: context.env.CONNECTIONS, secret: context.req.param('secret') });
  if (!resolved) {
    logEvent({ event: LogEvent.AuthRejected });
    return context.json(UNAUTHORIZED_BODY, HttpStatus.Unauthorized);
  }
  const requestedUpgrade = context.req.header(UPGRADE_HEADER);
  const isWebSocketUpgrade = requestedUpgrade !== undefined && requestedUpgrade.toLowerCase() === WEBSOCKET_UPGRADE;
  if (!isWebSocketUpgrade) return context.body(null, HttpStatus.UpgradeRequired, { [UPGRADE_HEADER]: WEBSOCKET_UPGRADE });
  const { connection, secretDigest } = resolved;
  const objectUrl = new URL(`${CONNECTOR_OBJECT_ORIGIN}${CONNECTOR_PATH_SUFFIX}`);
  objectUrl.searchParams.set(CONNECTOR_AGENT_PARAMETER, connection.agent);
  objectUrl.searchParams.set(CONNECTOR_DIGEST_PARAMETER, secretDigest);
  const inbox = accountInboxOf<ConnectorObject>({ bindings: context.env, accountId: connection.accountId });
  return inbox.fetch(new Request(objectUrl, context.req.raw));
});

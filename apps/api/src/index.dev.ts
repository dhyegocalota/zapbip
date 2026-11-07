import { createApp } from './app';
import { DAY_MS } from '@zapbip/types';
import type { Bindings } from './contract/env';
import { readDevelopmentMediaOrigin } from './dev/read-development-media-origin';
import { devOwnerRoutes } from './routes/dev-owner';

const DEVELOPMENT_MAX_FUTURE_SKEW_MS = 2 * DAY_MS;

export { DevAccountInbox as AccountInbox } from './dev/dev-account-inbox';

export default {
  fetch: (request: Request, env: Bindings, executionContext: ExecutionContext): Response | Promise<Response> =>
    createApp({
      extraRoutes: [devOwnerRoutes],
      developmentMediaOrigin: readDevelopmentMediaOrigin({ env }),
      maxFutureSkewMs: DEVELOPMENT_MAX_FUTURE_SKEW_MS,
    }).fetch(request, env, executionContext),
};

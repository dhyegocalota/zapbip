import { createApp } from './app';
import { DEVELOPMENT_MAX_FUTURE_SKEW_MS } from './adapters/whatsapp/whatsapp-constants';
import type { Bindings } from './contract/env';
import { readDevelopmentMediaOrigin } from './dev/read-development-media-origin';
import { devOwnerRoutes } from './routes/dev-owner';

export { DevAccountInbox as AccountInbox } from './dev/dev-account-inbox';

export default {
  fetch: (request: Request, env: Bindings): Response | Promise<Response> =>
    createApp({
      extraRoutes: [devOwnerRoutes],
      developmentMediaOrigin: readDevelopmentMediaOrigin({ env }),
      maxFutureSkewMs: DEVELOPMENT_MAX_FUTURE_SKEW_MS,
    }).fetch(request, env),
};

import { createApp } from './app';
import type { Bindings } from './contract/env';
import { readDevelopmentMediaOrigin } from './dev/read-development-media-origin';
import { devOwnerRoutes } from './routes/dev-owner';

export { DevAccountInbox as AccountInbox } from './dev/dev-account-inbox';

export default {
  fetch: (request: Request, env: Bindings): Response | Promise<Response> =>
    createApp({ extraRoutes: [devOwnerRoutes], developmentMediaOrigin: readDevelopmentMediaOrigin({ env }) }).fetch(request, env),
};

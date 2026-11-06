import { createApp } from './app';
import type { Bindings } from './contract/env';
import { devOwnerRoutes } from './routes/dev-owner';

export { DevAccountInbox as AccountInbox } from './dev/dev-account-inbox';

export default {
  fetch: (request: Request, env: Bindings, executionContext: ExecutionContext): Response | Promise<Response> =>
    createApp({ extraRoutes: [devOwnerRoutes] }).fetch(request, env, executionContext),
};

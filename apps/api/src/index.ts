import { createApp } from './app';
import { MAX_FUTURE_SKEW_MS } from './adapters/whatsapp/whatsapp-constants';
import type { Bindings } from './contract/env';

export { AccountInbox } from './account-inbox/account-inbox';

export default {
  fetch: (request: Request, env: Bindings): Response | Promise<Response> =>
    createApp({ extraRoutes: [], developmentMediaOrigin: null, maxFutureSkewMs: MAX_FUTURE_SKEW_MS }).fetch(request, env),
};

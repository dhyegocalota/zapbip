import { createApp } from './app';
import type { Bindings } from './contract/env';

export { AccountInbox } from './account-inbox/account-inbox';

export default {
  fetch: (request: Request, env: Bindings): Response | Promise<Response> => createApp({ includeSimulator: false }).fetch(request, env),
};

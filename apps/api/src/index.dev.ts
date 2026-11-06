import { createApp } from './app';
import type { Bindings } from './contract/env';

export { DevAccountInbox as AccountInbox } from './dev/dev-account-inbox';

export default {
  fetch: (request: Request, env: Bindings): Response | Promise<Response> => createApp({ includeSimulator: true }).fetch(request, env),
};

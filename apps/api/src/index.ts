import { createApp } from './app';
import { MAX_FUTURE_SKEW_MS } from './adapters/whatsapp/whatsapp-constants';
import { fetchByHost } from './backoffice/host-dispatch';
import type { Bindings } from './contract/env';
import { runScheduled } from './operations/scheduled';

export { AccountInbox } from './account-inbox/account-inbox';

export default {
  fetch: (request: Request, env: Bindings, executionContext: ExecutionContext): Response | Promise<Response> =>
    fetchByHost({
      request,
      env,
      executionContext,
      createMcpApp: () => createApp({ extraRoutes: [], developmentMediaOrigin: null, maxFutureSkewMs: MAX_FUTURE_SKEW_MS }),
    }),
  scheduled: (controller: ScheduledController, env: Bindings): Promise<void> =>
    runScheduled({ cron: controller.cron, now: controller.scheduledTime, env }),
};

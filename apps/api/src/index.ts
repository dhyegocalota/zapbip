import { createApp } from './app';
import type { Bindings } from './contract/env';
import { runScheduled } from './operations/scheduled';

export { AccountInbox } from './account-inbox/account-inbox';

export default {
  fetch: (request: Request, env: Bindings): Response | Promise<Response> => createApp({ extraRoutes: [] }).fetch(request, env),
  scheduled: async (controller: ScheduledController, env: Bindings): Promise<void> => {
    await runScheduled({ cron: controller.cron, env, now: controller.scheduledTime });
  },
};

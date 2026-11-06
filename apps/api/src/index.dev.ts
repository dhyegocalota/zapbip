import { createPlatformClock } from './adapters/platform/clock';
import { createApp } from './app';
import type { Bindings } from './contract/env';
import { runScheduled } from './operations/scheduled';
import { devOwnerRoutes } from './routes/dev-owner';

export { DevAccountInbox as AccountInbox } from './dev/dev-account-inbox';

export default {
  fetch: (request: Request, env: Bindings): Response | Promise<Response> =>
    createApp({ extraRoutes: [devOwnerRoutes] }).fetch(request, env),
  scheduled: async (controller: ScheduledController, env: Bindings): Promise<void> => {
    await runScheduled({ cron: controller.cron, env, now: createPlatformClock().now() });
  },
};

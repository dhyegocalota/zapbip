import { createApp } from './app';
import type { Bindings } from './contract/env';
import { runScheduled } from './operations/scheduled';
import { devOwnerRoutes } from './routes/dev-owner';

export { DevAccountInbox as AccountInbox } from './dev/dev-account-inbox';

export default {
  fetch: (request: Request, env: Bindings): Response | Promise<Response> =>
    createApp({ extraRoutes: [devOwnerRoutes] }).fetch(request, env),
  scheduled: (controller: ScheduledController, env: Bindings): Promise<void> =>
    runScheduled({ cron: controller.cron, now: controller.scheduledTime, env }),
};

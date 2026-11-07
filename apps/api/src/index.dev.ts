import { createApp } from './app';
import { DAY_MS } from '@zapbip/types';
import type { Bindings } from './contract/env';
import { runScheduled } from './operations/scheduled';
import { readDevelopmentMediaOrigin } from './dev/read-development-media-origin';
import { devOwnerRoutes } from './routes/dev-owner';
import { devSeedRoutes } from './routes/dev-seed';

const DEVELOPMENT_MAX_FUTURE_SKEW_MS = 2 * DAY_MS;

export { DevAccountInbox as AccountInbox } from './dev/dev-account-inbox';

export default {
  fetch: (request: Request, env: Bindings): Response | Promise<Response> =>
    createApp({
      extraRoutes: [devOwnerRoutes, devSeedRoutes],
      developmentMediaOrigin: readDevelopmentMediaOrigin({ env }),
      maxFutureSkewMs: DEVELOPMENT_MAX_FUTURE_SKEW_MS,
    }).fetch(request, env),
  scheduled: (controller: ScheduledController, env: Bindings): Promise<void> =>
    runScheduled({ cron: controller.cron, now: controller.scheduledTime, env }),
};

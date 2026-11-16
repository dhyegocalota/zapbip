import { HttpStatus } from '@zapbip/types';
import type { Hono } from 'hono';
import { BackofficeAuditTargetKind } from '../../audit/backoffice-audit-action';
import { grantOnboarding } from '../../auth/onboarding-grant';
import { StepUpOutcome } from '../../auth/step-up';
import { SEE_OTHER_STATUS } from '../../backoffice-constants';
import { BackofficeCopyKey } from '../../backoffice-copy';
import type { BackofficeEnv } from '../../backoffice-env';
import { redirectWithFlash, sessionDigestOf, takeFlash } from '../../flash/form-flash';
import { signedInPageContext } from '../../page-context';
import { rateLimitedResponse, stepUpOf } from '../step-up-gate';
import { ConnectNumberPage } from '../views/connect-number';

export function mountStepUp(input: {
  routes: Hono<BackofficeEnv>;
  path: string;
  grantedPath: string;
  targetId: string;
  title: BackofficeCopyKey;
  intro: BackofficeCopyKey;
}): void {
  const { routes, path, grantedPath, targetId, title, intro } = input;

  routes.get(path, async (context) => {
    const page = await signedInPageContext({ context });
    const flash = await takeFlash({ context, path });
    if (flash === null) return context.html(<ConnectNumberPage page={page} action={path} title={title} intro={intro} flash={null} />);
    return context.html(<ConnectNumberPage page={page} action={path} title={title} intro={intro} flash={flash} />, flash.status);
  });

  routes.post(path, async (context) => {
    const form = await context.req.parseBody();
    const outcome = await stepUpOf({ context, form, targetKind: BackofficeAuditTargetKind.Number, targetId });
    if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
    if (outcome === StepUpOutcome.Rejected) {
      return redirectWithFlash({
        context,
        path,
        flash: {
          status: HttpStatus.Unauthorized,
          failure: BackofficeCopyKey.StepUpRejected,
          errors: {},
          onboarding: null,
          selectedState: null,
        },
      });
    }
    await grantOnboarding({ database: context.env.CONNECTIONS, digest: sessionDigestOf({ context }), now: Date.now() });
    return context.redirect(grantedPath, SEE_OTHER_STATUS);
  });
}

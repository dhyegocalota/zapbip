import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import { readMetaAppSecret, readWhatsAppEnvironment } from '../../../adapters/whatsapp/read-whatsapp-env';
import { WHATSAPP_WEBHOOK_PATH } from '../../../contract/constants';
import { onboardNumber } from '../../../numbers/meta-onboarding';
import { BackofficeAuditAction } from '../../audit/backoffice-audit-action';
import { consumeGrant, hasLiveGrant } from '../../auth/onboarding-grant';
import { PagePolicy, SEE_OTHER_STATUS } from '../../backoffice-constants';
import { BackofficeCopyKey } from '../../backoffice-copy';
import type { BackofficeEnv } from '../../backoffice-env';
import { BackofficePath } from '../../backoffice-paths';
import { sessionDigestOf } from '../../flash/form-flash';
import { signedInPageContext } from '../../page-context';
import { NumberSegment } from '../number-paths';
import { parseOnboarding } from '../onboarding-form';
import { ConnectMetaPage } from '../views/connect-meta';
import { completeConnection, rejectionOf } from './connect-completion';
import { mountStepUp } from './connect-step-up';

const CONNECT_TARGET = NumberSegment.Connect;
const CONNECT_PATH = `${BackofficePath.Numbers}/${NumberSegment.Connect}`;
const META_PATH = `${CONNECT_PATH}/${NumberSegment.Meta}`;

export const connectRoutes = new Hono<BackofficeEnv>();

mountStepUp({
  routes: connectRoutes,
  path: CONNECT_PATH,
  grantedPath: META_PATH,
  targetId: CONNECT_TARGET,
  title: BackofficeCopyKey.ConnectTitle,
  intro: BackofficeCopyKey.ConnectIntro,
});

connectRoutes.get(META_PATH, async (context) => {
  const isGranted = await hasLiveGrant({ database: context.env.CONNECTIONS, digest: sessionDigestOf({ context }), now: Date.now() });
  if (!isGranted) return context.redirect(CONNECT_PATH, SEE_OTHER_STATUS);
  const page = await signedInPageContext({ context });
  context.set('pagePolicy', PagePolicy.EmbeddedSignup);
  return context.html(<ConnectMetaPage page={page} />);
});

connectRoutes.post(META_PATH, async (context) => {
  const form = await context.req.parseBody();
  const reject = rejectionOf({ context, path: CONNECT_PATH });
  const isGranted = await consumeGrant({ database: context.env.CONNECTIONS, digest: sessionDigestOf({ context }), now: Date.now() });
  if (!isGranted) return reject({ status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  const parsed = parseOnboarding({ form });
  if (!parsed.isValid) return reject({ status: HttpStatus.UnprocessableEntity, errors: parsed.errors });
  const { request } = parsed;
  const environment = readWhatsAppEnvironment({ env: context.env });
  return completeConnection({
    context,
    reject,
    action: BackofficeAuditAction.NumberRegistered,
    request,
    onboard: () =>
      onboardNumber({
        graphBaseUrl: environment.graphBaseUrl,
        appSecret: readMetaAppSecret({ env: context.env }),
        webhookUrl: `${context.env.PUBLIC_ORIGIN}${WHATSAPP_WEBHOOK_PATH}`,
        verifyToken: environment.verifyToken,
        code: request.signupCode,
        phoneNumberId: request.phoneNumberId,
        wabaId: request.wabaId,
        pin: request.pin,
        fetcher: fetch,
      }),
  });
});

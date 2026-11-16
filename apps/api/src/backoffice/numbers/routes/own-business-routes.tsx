import { HttpStatus } from '@zapbip/types';
import { type Context, Hono } from 'hono';
import { numberRegistryOf } from '../../../adapters/d1/d1-number-registry';
import { readMetaSystemUserToken, readWhatsAppEnvironment } from '../../../adapters/whatsapp/read-whatsapp-env';
import { WHATSAPP_WEBHOOK_PATH } from '../../../contract/constants';
import { GraphErrorKind } from '../../../numbers/graph-error-kind';
import {
  discoverOwnBusinessNumbers,
  OnboardingError,
  OnboardingStep,
  onboardOwnBusinessNumber,
  type OwnBusinessNumber,
} from '../../../numbers/meta-onboarding';
import { BackofficeAuditAction } from '../../audit/backoffice-audit-action';
import { consumeGrant, hasLiveGrant } from '../../auth/onboarding-grant';
import { SEE_OTHER_STATUS } from '../../backoffice-constants';
import { BackofficeCopyKey } from '../../backoffice-copy';
import type { BackofficeEnv } from '../../backoffice-env';
import { BackofficePath } from '../../backoffice-paths';
import { sessionDigestOf } from '../../flash/form-flash';
import { signedInPageContext } from '../../page-context';
import { NumberSegment } from '../number-paths';
import { parseOwnBusiness } from '../onboarding-form';
import { ConnectOwnBusinessPage } from '../views/connect-own-business';
import { ConnectOwnBusinessUnavailablePage } from '../views/connect-own-business-unavailable';
import { completeConnection, rejectionOf } from './connect-completion';
import { mountStepUp } from './connect-step-up';

const OWN_PATH = `${BackofficePath.Numbers}/${NumberSegment.Connect}/${NumberSegment.Own}`;
const SELECT_PATH = `${OWN_PATH}/${NumberSegment.Select}`;

export const ownBusinessRoutes = new Hono<BackofficeEnv>();

ownBusinessRoutes.use(`${OWN_PATH}/*`, async (context, next) => {
  if (readMetaSystemUserToken({ env: context.env }) !== null) return next();
  return context.html(<ConnectOwnBusinessUnavailablePage page={await signedInPageContext({ context })} />);
});

mountStepUp({
  routes: ownBusinessRoutes,
  path: OWN_PATH,
  grantedPath: SELECT_PATH,
  targetId: NumberSegment.Own,
  title: BackofficeCopyKey.ConnectOwnTitle,
  intro: BackofficeCopyKey.ConnectOwnIntro,
});

function systemUserTokenOf(input: { context: Context<BackofficeEnv> }): string {
  const token = readMetaSystemUserToken({ env: input.context.env });
  if (token === null) throw new Error('the system user token passed the gate without being set');
  return token;
}

function discoverNumbers(input: { context: Context<BackofficeEnv> }): Promise<OwnBusinessNumber[] | OnboardingError> {
  const { context } = input;
  return discoverOwnBusinessNumbers({
    graphBaseUrl: readWhatsAppEnvironment({ env: context.env }).graphBaseUrl,
    systemUserToken: systemUserTokenOf({ context }),
    fetcher: fetch,
  }).catch((error: unknown) => {
    if (!(error instanceof OnboardingError)) throw error;
    return error;
  });
}

ownBusinessRoutes.get(SELECT_PATH, async (context) => {
  const isGranted = await hasLiveGrant({ database: context.env.CONNECTIONS, digest: sessionDigestOf({ context }), now: Date.now() });
  if (!isGranted) return context.redirect(OWN_PATH, SEE_OTHER_STATUS);
  const page = await signedInPageContext({ context });
  const discovered = await discoverNumbers({ context });
  if (discovered instanceof OnboardingError) {
    const flash = { failure: null, errors: {}, onboarding: { step: discovered.step, kind: discovered.kind } };
    return context.html(<ConnectOwnBusinessPage page={page} numbers={[]} flash={flash} />, HttpStatus.BadGateway);
  }
  const known = await numberRegistryOf({ bindings: context.env }).findByPhoneNumberIds({
    phoneNumberIds: discovered.map((number) => number.phoneNumberId),
  });
  const knownIds = known.map((number) => number.phoneNumberId);
  const unregistered = discovered.filter((number) => !knownIds.includes(number.phoneNumberId));
  return context.html(<ConnectOwnBusinessPage page={page} numbers={unregistered} flash={null} />);
});

ownBusinessRoutes.post(SELECT_PATH, async (context) => {
  const form = await context.req.parseBody();
  const reject = rejectionOf({ context, path: OWN_PATH });
  const isGranted = await consumeGrant({ database: context.env.CONNECTIONS, digest: sessionDigestOf({ context }), now: Date.now() });
  if (!isGranted) return reject({ status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  const parsed = parseOwnBusiness({ form });
  if (!parsed.isValid) return reject({ status: HttpStatus.UnprocessableEntity, errors: parsed.errors });
  const { request } = parsed;
  const environment = readWhatsAppEnvironment({ env: context.env });
  const discovered = await discoverNumbers({ context });
  if (discovered instanceof OnboardingError) {
    return reject({ status: HttpStatus.BadGateway, onboarding: { step: discovered.step, kind: discovered.kind } });
  }
  const chosen = discovered.find((number) => number.phoneNumberId === request.phoneNumberId);
  if (chosen === undefined) {
    return reject({ status: HttpStatus.BadGateway, onboarding: { step: OnboardingStep.Read, kind: GraphErrorKind.NotFound } });
  }
  return completeConnection({
    context,
    reject,
    action: BackofficeAuditAction.NumberConnectedFromOwnBusiness,
    request: { phoneNumberId: chosen.phoneNumberId, wabaId: chosen.wabaId, label: request.label },
    onboard: () =>
      onboardOwnBusinessNumber({
        graphBaseUrl: environment.graphBaseUrl,
        systemUserToken: systemUserTokenOf({ context }),
        webhookUrl: `${context.env.PUBLIC_ORIGIN}${WHATSAPP_WEBHOOK_PATH}`,
        verifyToken: environment.verifyToken,
        phoneNumberId: chosen.phoneNumberId,
        wabaId: chosen.wabaId,
        pin: request.pin,
        fetcher: fetch,
      }),
  });
});

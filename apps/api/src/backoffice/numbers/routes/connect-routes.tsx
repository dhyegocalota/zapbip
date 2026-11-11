import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import { numberRegistryOf } from '../../../adapters/d1/d1-number-registry';
import { readMetaAppSecret, readWhatsAppEnvironment } from '../../../adapters/whatsapp/read-whatsapp-env';
import { logOperatorEvent } from '../../../adapters/whatsapp/operator-log';
import { OperatorEvent, OperatorLogField } from '../../../adapters/whatsapp/whatsapp-enums';
import { WHATSAPP_WEBHOOK_PATH } from '../../../contract/constants';
import { OnboardingError, onboardNumber } from '../../../numbers/meta-onboarding';
import { RegistrationConflictError } from '../../../numbers/registration-conflict';
import { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../../audit/backoffice-audit-action';
import { consumeGrant, grantOnboarding, hasLiveGrant } from '../../auth/onboarding-grant';
import { StepUpOutcome } from '../../auth/step-up';
import { PagePolicy, SEE_OTHER_STATUS } from '../../backoffice-constants';
import { BackofficeCopyKey } from '../../backoffice-copy';
import type { BackofficeEnv } from '../../backoffice-env';
import { BackofficeNotice } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { type FlashStatus, type FormFlash, redirectWithFlash, sessionDigestOf, takeFlash } from '../../flash/form-flash';
import { signedInPageContext } from '../../page-context';
import type { FieldErrors } from '../field-errors';
import { auditNumberAction } from '../number-audit';
import { NumberFormField } from '../number-form-fields';
import { numberPath, NumberSegment, withNotice } from '../number-paths';
import { parseOnboarding } from '../onboarding-form';
import { rateLimitedResponse, stepUpOf } from '../step-up-gate';
import { ConnectMetaPage } from '../views/connect-meta';
import { ConnectNumberPage } from '../views/connect-number';

const TARGET_KIND = BackofficeAuditTargetKind.Number;
const CONNECT_TARGET = NumberSegment.Connect;
const CONNECT_PATH = `${BackofficePath.Numbers}/${NumberSegment.Connect}`;
const META_PATH = `${CONNECT_PATH}/${NumberSegment.Meta}`;

export const connectRoutes = new Hono<BackofficeEnv>();

connectRoutes.get(CONNECT_PATH, async (context) => {
  const page = await signedInPageContext({ context });
  const flash = await takeFlash({ context, path: CONNECT_PATH });
  if (flash === null) return context.html(<ConnectNumberPage page={page} flash={null} />);
  return context.html(<ConnectNumberPage page={page} flash={flash} />, flash.status);
});

connectRoutes.post(CONNECT_PATH, async (context) => {
  const form = await context.req.parseBody();
  const outcome = await stepUpOf({ context, form, targetKind: TARGET_KIND, targetId: CONNECT_TARGET });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected) {
    return redirectWithFlash({
      context,
      path: CONNECT_PATH,
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
  return context.redirect(META_PATH, SEE_OTHER_STATUS);
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
  const reject = (input: { status: FlashStatus } & Partial<Pick<FormFlash, 'failure' | 'errors' | 'onboarding'>>) =>
    redirectWithFlash({
      context,
      path: CONNECT_PATH,
      flash: { failure: null, errors: {}, onboarding: null, selectedState: null, ...input },
    });
  const isGranted = await consumeGrant({ database: context.env.CONNECTIONS, digest: sessionDigestOf({ context }), now: Date.now() });
  if (!isGranted) return reject({ status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  const parsed = parseOnboarding({ form });
  if (!parsed.isValid) return reject({ status: HttpStatus.UnprocessableEntity, errors: parsed.errors });
  const { request } = parsed;
  const duplicateErrors: FieldErrors = { [NumberFormField.PhoneNumberId]: BackofficeCopyKey.FieldErrorDuplicate };
  const registry = numberRegistryOf({ bindings: context.env });
  const known = await registry.findByPhoneNumberIds({ phoneNumberIds: [request.phoneNumberId] });
  if (known.length > 0) return reject({ status: HttpStatus.Conflict, errors: duplicateErrors });
  const environment = readWhatsAppEnvironment({ env: context.env });
  const onboarded = await onboardNumber({
    graphBaseUrl: environment.graphBaseUrl,
    appSecret: readMetaAppSecret({ env: context.env }),
    webhookUrl: `${context.env.PUBLIC_ORIGIN}${WHATSAPP_WEBHOOK_PATH}`,
    verifyToken: environment.verifyToken,
    code: request.signupCode,
    phoneNumberId: request.phoneNumberId,
    wabaId: request.wabaId,
    pin: request.pin,
    fetcher: fetch,
  }).catch((error: unknown) => {
    if (!(error instanceof OnboardingError)) throw error;
    return error;
  });
  if (onboarded instanceof OnboardingError) {
    logOperatorEvent({
      event: OperatorEvent.BackofficeOnboardingFailed,
      fields: { [OperatorLogField.OnboardingStep]: onboarded.step, [OperatorLogField.OnboardingKind]: onboarded.kind },
    });
    await auditNumberAction({
      context,
      action: BackofficeAuditAction.NumberRegistered,
      outcome: BackofficeAuditOutcome.Failed,
      targetKind: TARGET_KIND,
      targetId: CONNECT_TARGET,
    });
    return reject({ status: HttpStatus.BadGateway, onboarding: { step: onboarded.step, kind: onboarded.kind } });
  }
  const registered = await registry
    .registerNumber({
      phoneNumberId: request.phoneNumberId,
      wabaId: request.wabaId,
      displayNumber: onboarded.displayNumber,
      label: request.label,
      accessToken: onboarded.accessToken,
    })
    .catch((error: unknown) => {
      if (!(error instanceof RegistrationConflictError)) throw error;
      return error;
    });
  if (registered instanceof RegistrationConflictError) return reject({ status: HttpStatus.Conflict, errors: duplicateErrors });
  await auditNumberAction({
    context,
    action: BackofficeAuditAction.NumberRegistered,
    outcome: BackofficeAuditOutcome.Succeeded,
    targetKind: TARGET_KIND,
    targetId: registered.numberId,
  });
  const notice = registered.backfilledAccounts > 0 ? BackofficeNotice.RegisteredWithBackfill : BackofficeNotice.Registered;
  return context.redirect(withNotice({ path: numberPath({ numberId: registered.numberId }), notice }), SEE_OTHER_STATUS);
});

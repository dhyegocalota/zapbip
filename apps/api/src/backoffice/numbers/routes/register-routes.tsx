import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import { numberRegistryOf } from '../../../adapters/d1/d1-number-registry';
import { numberAdminOf } from '../../../adapters/d1/d1-number-admin';
import { RegistrationConflictError, RegistrationConflictField } from '../../../numbers/registration-conflict';
import { StepUpOutcome } from '../../auth/step-up';
import { type FlashStatus, redirectWithFlash, takeFlash } from '../../flash/form-flash';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../audit/backoffice-audit-action';
import { SEE_OTHER_STATUS } from '../../backoffice-constants';
import type { BackofficeEnv } from '../../backoffice-env';
import { BackofficeCopyKey } from '../../backoffice-copy';
import { BackofficeNotice } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { signedInPageContext } from '../../page-context';
import { auditNumberAction } from '../number-audit';
import { NumberFormField } from '../number-form-fields';
import { numberPath, NumberSegment, withNotice } from '../number-paths';
import { type FieldErrors, parseRegistration, type RegistrationValues } from '../registration-form';
import { rateLimitedResponse, stepUpOf } from '../step-up-gate';
import { RegisterNumberPage } from '../views/register-number';

const TARGET_KIND = 'number';
const NEW_NUMBER_TARGET = NumberSegment.New;
const REGISTER_PATH = `${BackofficePath.Numbers}/${NumberSegment.New}`;
const EMPTY_VALUES: RegistrationValues = {
  metaApp: '',
  metaAppId: '',
  metaAppName: '',
  phoneNumberId: '',
  wabaId: '',
  displayNumber: '',
  label: '',
};
const CONFLICT_FORM_FIELDS: Record<RegistrationConflictField, NumberFormField> = {
  [RegistrationConflictField.MetaAppId]: NumberFormField.MetaAppId,
  [RegistrationConflictField.PhoneNumberId]: NumberFormField.PhoneNumberId,
  [RegistrationConflictField.DisplayNumber]: NumberFormField.DisplayNumber,
};

export const registerRoutes = new Hono<BackofficeEnv>();

registerRoutes.get(REGISTER_PATH, async (context) => {
  const metaApps = await numberAdminOf({ bindings: context.env }).listMetaApps();
  const page = await signedInPageContext({ context });
  const flash = await takeFlash({ context, path: REGISTER_PATH });
  if (flash === null) {
    return context.html(<RegisterNumberPage page={page} metaApps={metaApps} values={EMPTY_VALUES} errors={{}} failure={null} />);
  }
  if (flash.values === null) throw new Error('a register flash carries no values');
  return context.html(
    <RegisterNumberPage page={page} metaApps={metaApps} values={flash.values} errors={flash.errors} failure={flash.failure} />,
    flash.status,
  );
});

registerRoutes.post(REGISTER_PATH, async (context) => {
  const form = await context.req.parseBody();
  const admin = numberAdminOf({ bindings: context.env });
  const metaApps = await admin.listMetaApps();
  const parsed = parseRegistration({ form, knownMetaAppRefs: metaApps.map((metaApp) => metaApp.metaAppRef) });
  const reject = (input: { status: FlashStatus; errors: FieldErrors; failure: BackofficeCopyKey | null }) =>
    redirectWithFlash({ context, path: REGISTER_PATH, flash: { ...input, values: parsed.values, selectedState: null } });
  if (!parsed.isValid) return reject({ status: HttpStatus.UnprocessableEntity, errors: parsed.errors, failure: null });
  const outcome = await stepUpOf({ context, form, targetKind: TARGET_KIND, targetId: NEW_NUMBER_TARGET });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected) {
    return reject({ status: HttpStatus.Unauthorized, errors: {}, failure: BackofficeCopyKey.StepUpRejected });
  }
  const registry = numberRegistryOf({ bindings: context.env });
  const { request } = parsed;
  const numberFields = {
    phoneNumberId: request.phoneNumberId,
    wabaId: request.wabaId,
    displayNumber: request.displayNumber,
    label: request.label,
    accessToken: request.accessToken,
  };
  const registered = await (
    'metaAppRef' in request.metaApp
      ? registry.registerNumber({ ...numberFields, metaAppRef: request.metaApp.metaAppRef })
      : registry.registerNumberWithNewMetaApp({ metaApp: request.metaApp, number: numberFields })
  ).catch((error: unknown) => {
    if (!(error instanceof RegistrationConflictError)) throw error;
    return error;
  });
  if (registered instanceof RegistrationConflictError) {
    const errors: FieldErrors = { [CONFLICT_FORM_FIELDS[registered.field]]: BackofficeCopyKey.FieldErrorDuplicate };
    return reject({ status: HttpStatus.Conflict, errors, failure: null });
  }
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

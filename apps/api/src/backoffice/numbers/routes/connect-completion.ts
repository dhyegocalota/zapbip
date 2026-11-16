import { HttpStatus } from '@zapbip/types';
import type { Context } from 'hono';
import { numberRegistryOf } from '../../../adapters/d1/d1-number-registry';
import { logOperatorEvent } from '../../../adapters/whatsapp/operator-log';
import { OperatorEvent, OperatorLogField } from '../../../adapters/whatsapp/whatsapp-enums';
import { type OnboardedNumber, OnboardingError } from '../../../numbers/meta-onboarding';
import { RegistrationConflictError } from '../../../numbers/registration-conflict';
import { type BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../../audit/backoffice-audit-action';
import { SEE_OTHER_STATUS } from '../../backoffice-constants';
import { BackofficeCopyKey } from '../../backoffice-copy';
import type { BackofficeEnv } from '../../backoffice-env';
import { BackofficeNotice } from '../../backoffice-notice';
import { type FlashStatus, type FormFlash, redirectWithFlash } from '../../flash/form-flash';
import type { FieldErrors } from '../field-errors';
import { auditNumberAction } from '../number-audit';
import { NumberFormField } from '../number-form-fields';
import { numberPath, NumberSegment, withNotice } from '../number-paths';

const TARGET_KIND = BackofficeAuditTargetKind.Number;
const CONNECT_TARGET = NumberSegment.Connect;
const DUPLICATE_ERRORS: FieldErrors = { [NumberFormField.PhoneNumberId]: BackofficeCopyKey.FieldErrorDuplicate };

export type RejectConnection = (
  input: { status: FlashStatus } & Partial<Pick<FormFlash, 'failure' | 'errors' | 'onboarding'>>,
) => Promise<Response>;

export function rejectionOf(input: { context: Context<BackofficeEnv>; path: string }): RejectConnection {
  const { context, path } = input;
  return (flash) =>
    redirectWithFlash({ context, path, flash: { failure: null, errors: {}, onboarding: null, selectedState: null, ...flash } });
}

export async function completeConnection(input: {
  context: Context<BackofficeEnv>;
  reject: RejectConnection;
  action: BackofficeAuditAction;
  request: { phoneNumberId: string; wabaId: string; label: string };
  onboard: () => Promise<OnboardedNumber>;
}): Promise<Response> {
  const { context, reject, action, request, onboard } = input;
  const registry = numberRegistryOf({ bindings: context.env });
  const known = await registry.findByPhoneNumberIds({ phoneNumberIds: [request.phoneNumberId] });
  if (known.length > 0) return reject({ status: HttpStatus.Conflict, errors: DUPLICATE_ERRORS });
  const onboarded = await onboard().catch((error: unknown) => {
    if (!(error instanceof OnboardingError)) throw error;
    return error;
  });
  if (onboarded instanceof OnboardingError) {
    logOperatorEvent({
      event: OperatorEvent.BackofficeOnboardingFailed,
      fields: { [OperatorLogField.OnboardingStep]: onboarded.step, [OperatorLogField.OnboardingKind]: onboarded.kind },
    });
    await auditNumberAction({ context, action, outcome: BackofficeAuditOutcome.Failed, targetKind: TARGET_KIND, targetId: CONNECT_TARGET });
    return reject({ status: HttpStatus.BadGateway, onboarding: { step: onboarded.step, kind: onboarded.kind } });
  }
  const registered = await registry
    .registerNumber({
      phoneNumberId: request.phoneNumberId,
      wabaId: request.wabaId,
      displayNumber: onboarded.displayNumber,
      label: request.label,
      accessToken: onboarded.accessToken,
      pin: onboarded.pin,
    })
    .catch((error: unknown) => {
      if (!(error instanceof RegistrationConflictError)) throw error;
      return error;
    });
  if (registered instanceof RegistrationConflictError) return reject({ status: HttpStatus.Conflict, errors: DUPLICATE_ERRORS });
  await auditNumberAction({
    context,
    action,
    outcome: BackofficeAuditOutcome.Succeeded,
    targetKind: TARGET_KIND,
    targetId: registered.numberId,
  });
  const notice = registered.backfilledAccounts > 0 ? BackofficeNotice.RegisteredWithBackfill : BackofficeNotice.Registered;
  return context.redirect(withNotice({ path: numberPath({ numberId: registered.numberId }), notice }), SEE_OTHER_STATUS);
}

import { HttpStatus, WhatsAppNumberState } from '@zapbip/types';
import { Hono } from 'hono';
import { numberAdminOf } from '../../../adapters/d1/d1-number-admin';
import { numberRegistryOf } from '../../../adapters/d1/d1-number-registry';
import { createGraphClient } from '../../../adapters/whatsapp/graph-client';
import { readWhatsAppEnvironment } from '../../../adapters/whatsapp/read-whatsapp-env';
import { allowedTargetsOf } from '../../../numbers/number-state';
import { parseVerificationSnapshot, VerificationOutcome, verifyNumber } from '../../../numbers/number-verification';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../audit/backoffice-audit-action';
import { StepUpOutcome } from '../../auth/step-up';
import { SEE_OTHER_STATUS } from '../../backoffice-constants';
import { BackofficeCopyKey } from '../../backoffice-copy';
import type { BackofficeEnv } from '../../backoffice-env';
import { BackofficeNotice } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { errorResponse } from '../../error-response';
import { textFieldOf } from '../../form-fields';
import { signedInPageContext } from '../../page-context';
import { detailResponse, findNumberEntry } from '../number-detail-response';
import { auditNumberAction } from '../number-audit';
import { CHECKED_VALUE, NumberFormField } from '../number-form-fields';
import { numberPath, NumberSegment, withNotice } from '../number-paths';
import { rateLimitedResponse, stepUpOf } from '../step-up-gate';
import { NumberVerificationPage } from '../views/number-verification';

const TARGET_KIND = 'number';
const NUMBER_PARAMETER = 'numberId';
const NUMBER_ROUTE = `${BackofficePath.Numbers}/:${NUMBER_PARAMETER}`;
const STATE_VALUES: string[] = Object.values(WhatsAppNumberState);

export const numberRoutes = new Hono<BackofficeEnv>();

numberRoutes.get(NUMBER_ROUTE, (context) =>
  detailResponse({ context, numberId: context.req.param(NUMBER_PARAMETER), status: HttpStatus.Ok, failure: null }),
);

numberRoutes.post(`${NUMBER_ROUTE}/${NumberSegment.Verify}`, async (context) => {
  const numberId = context.req.param(NUMBER_PARAMETER);
  const entry = await findNumberEntry({ context, numberId });
  if (entry === null) return errorResponse({ context, status: HttpStatus.NotFound });
  const outcome = await stepUpOf({ context, form: await context.req.parseBody(), targetKind: TARGET_KIND, targetId: numberId });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected) {
    return detailResponse({ context, numberId, status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  }
  const { accessToken } = await numberRegistryOf({ bindings: context.env }).openForInbound({ numberId });
  const graph = createGraphClient({
    baseUrl: readWhatsAppEnvironment({ env: context.env }).graphBaseUrl,
    accessToken,
    developmentMediaOrigin: null,
    fetcher: fetch,
  });
  const snapshot = await verifyNumber({
    graph,
    phoneNumberId: entry.phoneNumberId,
    wabaId: entry.wabaId,
    displayNumber: entry.displayNumber,
    now: Date.now(),
  });
  const isVerified = snapshot.outcome === VerificationOutcome.Verified;
  await numberAdminOf({ bindings: context.env }).recordVerification({
    numberId,
    snapshot: JSON.stringify(snapshot),
    verifiedAt: isVerified ? snapshot.checkedAt : null,
  });
  await auditNumberAction({
    context,
    action: BackofficeAuditAction.NumberVerified,
    outcome: isVerified ? BackofficeAuditOutcome.Succeeded : BackofficeAuditOutcome.Failed,
    targetKind: TARGET_KIND,
    targetId: numberId,
  });
  return context.redirect(numberPath({ numberId, segment: NumberSegment.Verification }), SEE_OTHER_STATUS);
});

numberRoutes.get(`${NUMBER_ROUTE}/${NumberSegment.Verification}`, async (context) => {
  const entry = await findNumberEntry({ context, numberId: context.req.param(NUMBER_PARAMETER) });
  if (entry === null || entry.verificationSnapshot === null) return errorResponse({ context, status: HttpStatus.NotFound });
  const page = await signedInPageContext({ context });
  const snapshot = parseVerificationSnapshot({ text: entry.verificationSnapshot });
  return context.html(<NumberVerificationPage page={page} numberId={entry.numberId} label={entry.label} snapshot={snapshot} />);
});

numberRoutes.post(`${NUMBER_ROUTE}/${NumberSegment.State}`, async (context) => {
  const numberId = context.req.param(NUMBER_PARAMETER);
  const entry = await findNumberEntry({ context, numberId });
  if (entry === null) return errorResponse({ context, status: HttpStatus.NotFound });
  const form = await context.req.parseBody();
  const target = textFieldOf({ form, name: NumberFormField.State });
  const allowedTargets = allowedTargetsOf({ from: entry.state, verifiedAt: entry.verifiedAt });
  const isAllowedTarget = target !== null && STATE_VALUES.includes(target) && allowedTargets.includes(target as WhatsAppNumberState);
  const isDisableConfirmed = textFieldOf({ form, name: NumberFormField.ConfirmDisable }) === CHECKED_VALUE;
  const isUnconfirmedDisable = target === WhatsAppNumberState.Disabled && !isDisableConfirmed;
  if (!isAllowedTarget || isUnconfirmedDisable) {
    return detailResponse({ context, numberId, status: HttpStatus.UnprocessableEntity, failure: BackofficeCopyKey.ErrorSummaryTitle });
  }
  const outcome = await stepUpOf({ context, form, targetKind: TARGET_KIND, targetId: numberId });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected) {
    return detailResponse({ context, numberId, status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  }
  await numberRegistryOf({ bindings: context.env }).transition({ numberId, to: target as WhatsAppNumberState });
  await auditNumberAction({
    context,
    action: BackofficeAuditAction.NumberStateChanged,
    outcome: BackofficeAuditOutcome.Succeeded,
    targetKind: TARGET_KIND,
    targetId: numberId,
  });
  return context.redirect(withNotice({ path: numberPath({ numberId }), notice: BackofficeNotice.StateChanged }), SEE_OTHER_STATUS);
});

numberRoutes.post(`${NUMBER_ROUTE}/${NumberSegment.AccessToken}`, async (context) => {
  const numberId = context.req.param(NUMBER_PARAMETER);
  const entry = await findNumberEntry({ context, numberId });
  if (entry === null) return errorResponse({ context, status: HttpStatus.NotFound });
  const form = await context.req.parseBody();
  const accessToken = textFieldOf({ form, name: NumberFormField.AccessToken });
  if (accessToken === null || accessToken.trim().length === 0) {
    return detailResponse({ context, numberId, status: HttpStatus.UnprocessableEntity, failure: BackofficeCopyKey.ErrorSummaryTitle });
  }
  const outcome = await stepUpOf({ context, form, targetKind: TARGET_KIND, targetId: numberId });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected) {
    return detailResponse({ context, numberId, status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  }
  await numberAdminOf({ bindings: context.env }).replaceAccessToken({ numberId, accessToken: accessToken.trim() });
  await auditNumberAction({
    context,
    action: BackofficeAuditAction.NumberAccessTokenRotated,
    outcome: BackofficeAuditOutcome.Succeeded,
    targetKind: TARGET_KIND,
    targetId: numberId,
  });
  return context.redirect(withNotice({ path: numberPath({ numberId }), notice: BackofficeNotice.AccessTokenReplaced }), SEE_OTHER_STATUS);
});

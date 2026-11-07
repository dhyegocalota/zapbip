import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import { numberAdminOf } from '../../../adapters/d1/d1-number-admin';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../audit/backoffice-audit-action';
import { StepUpOutcome } from '../../auth/step-up';
import { SEE_OTHER_STATUS } from '../../backoffice-constants';
import { BackofficeCopyKey } from '../../backoffice-copy';
import type { BackofficeEnv } from '../../backoffice-env';
import { BackofficeNotice } from '../../backoffice-notice';
import { errorResponse } from '../../error-response';
import { textFieldOf } from '../../form-fields';
import { findNumberEntry, rejectDetail } from '../number-detail-response';
import { auditNumberAction } from '../number-audit';
import { NumberFormField } from '../number-form-fields';
import { APP_SECRET_SEGMENT, META_APPS_PATH, numberPath, withNotice } from '../number-paths';
import { rateLimitedResponse, stepUpOf } from '../step-up-gate';

const TARGET_KIND = 'meta_app';
const META_APP_PARAMETER = 'metaAppRef';

export const appSecretRoutes = new Hono<BackofficeEnv>();

appSecretRoutes.post(`${META_APPS_PATH}/:${META_APP_PARAMETER}/${APP_SECRET_SEGMENT}`, async (context) => {
  const metaAppRef = context.req.param(META_APP_PARAMETER);
  const form = await context.req.parseBody();
  const numberId = textFieldOf({ form, name: NumberFormField.NumberId });
  const entry = numberId === null ? null : await findNumberEntry({ context, numberId });
  if (numberId === null || entry === null || entry.metaAppRef !== metaAppRef)
    return errorResponse({ context, status: HttpStatus.NotFound });
  const appSecret = textFieldOf({ form, name: NumberFormField.AppSecret });
  if (appSecret === null || appSecret.trim().length === 0) {
    return rejectDetail({ context, numberId, status: HttpStatus.UnprocessableEntity, failure: BackofficeCopyKey.ErrorSummaryTitle });
  }
  const outcome = await stepUpOf({ context, form, targetKind: TARGET_KIND, targetId: metaAppRef });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected) {
    return rejectDetail({ context, numberId, status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  }
  await numberAdminOf({ bindings: context.env }).replaceAppSecret({ metaAppRef, appSecret: appSecret.trim() });
  await auditNumberAction({
    context,
    action: BackofficeAuditAction.MetaAppSecretRotated,
    outcome: BackofficeAuditOutcome.Succeeded,
    targetKind: TARGET_KIND,
    targetId: metaAppRef,
  });
  return context.redirect(withNotice({ path: numberPath({ numberId }), notice: BackofficeNotice.AppSecretReplaced }), SEE_OTHER_STATUS);
});

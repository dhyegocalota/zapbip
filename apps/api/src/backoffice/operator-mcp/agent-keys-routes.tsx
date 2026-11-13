import { DAY_MS, HttpStatus } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import { writeAudit } from '../audit/audit-log';
import { StepUpOutcome } from '../auth/step-up';
import { LABEL_MAX_LENGTH, SEE_OTHER_STATUS } from '../backoffice-constants';
import { BackofficeCopyKey } from '../backoffice-copy';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficeNotice } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { errorResponse } from '../error-response';
import { type FlashStatus, redirectWithFlash, takeFlash } from '../flash/form-flash';
import { textFieldOf } from '../form-fields';
import { withNotice } from '../numbers/number-paths';
import { rateLimitedResponse, stepUpOf } from '../numbers/step-up-gate';
import { signedInPageContext } from '../page-context';
import { AgentKeyFormField } from './agent-key-form-fields';
import { AgentKeyCreatedPage, AgentKeysPage } from './agent-keys-page';
import { createOperatorKey, hashOperatorKey, parseKeyLifetimeDays } from './operator-key';
import { insertOperatorKey, listOperatorKeys, revokeOperatorKey } from './operator-key-store';
import {
  OPERATOR_KEY_DEFAULT_LIFETIME_DAYS,
  OPERATOR_KEY_ID_BYTES,
  OPERATOR_KEY_LIST_LIMIT,
  OPERATOR_KEY_SECRET_BYTES,
} from './operator-mcp-constants';

const CREATE_TARGET = 'create';
const TARGET_KIND = BackofficeAuditTargetKind.AgentKey;

export const agentKeysRoutes = new Hono<BackofficeEnv>();

function rejectKeys(input: { context: Context<BackofficeEnv>; status: FlashStatus; failure: BackofficeCopyKey }): Promise<Response> {
  const { context, status, failure } = input;
  return redirectWithFlash({
    context,
    path: BackofficePath.AgentKeys,
    flash: { status, failure, errors: {}, onboarding: null, selectedState: null },
  });
}

function auditKeyAction(input: {
  context: Context<BackofficeEnv>;
  action: BackofficeAuditAction;
  keyId: string;
  now: number;
}): Promise<void> {
  const { context, action, keyId, now } = input;
  return writeAudit({
    database: context.env.CONNECTIONS,
    entry: {
      now,
      action,
      outcome: BackofficeAuditOutcome.Succeeded,
      targetKind: TARGET_KIND,
      targetId: keyId,
      clientAddress: context.get('clientAddress'),
      actorKeyId: null,
    },
  });
}

function lifetimeDaysOf(input: { value: string | null }): number | null {
  const { value } = input;
  if (value === null || value.trim() === '') return OPERATOR_KEY_DEFAULT_LIFETIME_DAYS;
  return parseKeyLifetimeDays({ value: value.trim() });
}

function labelOf(input: { value: string | null }): string | null {
  if (input.value === null) return null;
  const label = input.value.trim();
  const isLabelInvalid = label === '' || label.length > LABEL_MAX_LENGTH;
  return isLabelInvalid ? null : label;
}

agentKeysRoutes.get(BackofficePath.AgentKeys, async (context) => {
  const flash = await takeFlash({ context, path: BackofficePath.AgentKeys });
  const keys = await listOperatorKeys({ database: context.env.CONNECTIONS, limit: OPERATOR_KEY_LIST_LIMIT });
  return context.html(
    <AgentKeysPage
      page={await signedInPageContext({ context })}
      failure={flash === null ? null : flash.failure}
      keys={keys}
      now={Date.now()}
    />,
    flash === null ? HttpStatus.Ok : flash.status,
  );
});

agentKeysRoutes.post(BackofficePath.AgentKeys, async (context) => {
  const form = await context.req.parseBody();
  const label = labelOf({ value: textFieldOf({ form, name: AgentKeyFormField.Label }) });
  const lifetimeDays = lifetimeDaysOf({ value: textFieldOf({ form, name: AgentKeyFormField.LifetimeDays }) });
  if (label === null || lifetimeDays === null)
    return rejectKeys({ context, status: HttpStatus.UnprocessableEntity, failure: BackofficeCopyKey.AgentKeysInvalid });
  const outcome = await stepUpOf({ context, form, targetKind: TARGET_KIND, targetId: CREATE_TARGET });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected)
    return rejectKeys({ context, status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  const now = Date.now();
  const expiresAt = now + lifetimeDays * DAY_MS;
  const { keyId, key } = createOperatorKey({
    idBytes: crypto.getRandomValues(new Uint8Array(OPERATOR_KEY_ID_BYTES)),
    secretBytes: crypto.getRandomValues(new Uint8Array(OPERATOR_KEY_SECRET_BYTES)),
  });
  await insertOperatorKey({
    database: context.env.CONNECTIONS,
    keyId,
    label,
    keyDigest: await hashOperatorKey({ key }),
    createdAt: now,
    expiresAt,
  });
  await auditKeyAction({ context, action: BackofficeAuditAction.AgentKeyCreated, keyId, now });
  const endpoint = `${new URL(context.env.BACKOFFICE_ORIGIN).origin}${BackofficePath.OperatorMcp}`;
  return context.html(
    <AgentKeyCreatedPage page={await signedInPageContext({ context })} operatorKey={key} endpoint={endpoint} expiresAt={expiresAt} />,
    HttpStatus.Ok,
  );
});

agentKeysRoutes.post(BackofficePath.AgentKeysRevoke, async (context) => {
  const form = await context.req.parseBody();
  const keyId = textFieldOf({ form, name: AgentKeyFormField.KeyId });
  const now = Date.now();
  const isRevoked = keyId !== null && (await revokeOperatorKey({ database: context.env.CONNECTIONS, keyId, now }));
  if (!isRevoked) return errorResponse({ context, status: HttpStatus.NotFound });
  await auditKeyAction({ context, action: BackofficeAuditAction.AgentKeyRevoked, keyId, now });
  return context.redirect(withNotice({ path: BackofficePath.AgentKeys, notice: BackofficeNotice.AgentKeyRevoked }), SEE_OTHER_STATUS);
});

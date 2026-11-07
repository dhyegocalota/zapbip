import { HttpStatus } from '@zapbip/types';
import type { Context } from 'hono';
import { RETRY_AFTER_SECONDS } from '../auth/rate-limit';
import { StepUpOutcome, verifyStepUp } from '../auth/step-up';
import type { BackofficeEnv } from '../backoffice-env';
import { errorResponse } from '../error-response';
import { type FormBody, textFieldOf } from '../form-fields';
import { NumberFormField } from './number-form-fields';

export async function stepUpOf(input: {
  context: Context<BackofficeEnv>;
  form: FormBody;
  targetKind: string;
  targetId: string;
}): Promise<StepUpOutcome> {
  const { context, form, targetKind, targetId } = input;
  const code = textFieldOf({ form, name: NumberFormField.Code });
  if (code === null) return StepUpOutcome.Rejected;
  return verifyStepUp({
    env: context.env,
    code,
    now: Date.now(),
    clientAddress: context.get('clientAddress'),
    targetKind,
    targetId,
  });
}

export function rateLimitedResponse(input: { context: Context<BackofficeEnv> }): Response | Promise<Response> {
  return errorResponse({ context: input.context, status: HttpStatus.TooManyRequests, headers: { 'Retry-After': RETRY_AFTER_SECONDS } });
}

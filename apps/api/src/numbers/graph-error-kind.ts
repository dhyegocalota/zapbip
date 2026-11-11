import { HttpStatus } from '@zapbip/types';
import { GRAPH_NO_RESPONSE_STATUS, type GraphRequestError } from '../adapters/whatsapp/graph-client';
import { WhatsAppErrorCode } from '../adapters/whatsapp/whatsapp-enums';

export enum GraphErrorKind {
  Auth = 'auth',
  NotFound = 'not_found',
  Network = 'network',
  Upstream = 'upstream',
  CodeExpired = 'code_expired',
  PinMismatch = 'pin_mismatch',
  RateLimited = 'rate_limited',
  NotGranted = 'not_granted',
  WebhookClaimedElsewhere = 'webhook_claimed_elsewhere',
}

const KIND_BY_STATUS: Record<number, GraphErrorKind> = {
  [HttpStatus.Unauthorized]: GraphErrorKind.Auth,
  [HttpStatus.Forbidden]: GraphErrorKind.Auth,
  [HttpStatus.NotFound]: GraphErrorKind.NotFound,
  [GRAPH_NO_RESPONSE_STATUS]: GraphErrorKind.Network,
};

const KIND_BY_ERROR_CODE: Record<number, GraphErrorKind> = {
  [WhatsAppErrorCode.PinMismatch]: GraphErrorKind.PinMismatch,
  [WhatsAppErrorCode.RegistrationRateLimited]: GraphErrorKind.RateLimited,
  [WhatsAppErrorCode.RateLimitedApp]: GraphErrorKind.RateLimited,
  [WhatsAppErrorCode.RateLimitedTier]: GraphErrorKind.RateLimited,
  [WhatsAppErrorCode.RateLimitedThroughput]: GraphErrorKind.RateLimited,
};

export function graphErrorKindOf(input: { error: GraphRequestError }): GraphErrorKind {
  const { errorCode, status } = input.error;
  const codeKind = errorCode === null ? undefined : KIND_BY_ERROR_CODE[errorCode];
  if (codeKind !== undefined) return codeKind;
  const statusKind = KIND_BY_STATUS[status];
  return statusKind === undefined ? GraphErrorKind.Upstream : statusKind;
}

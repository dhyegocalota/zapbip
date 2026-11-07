import { ChannelError } from '@zapbip/core';
import { ChannelErrorKind, HttpStatus } from '@zapbip/types';
import { GRAPH_NO_RESPONSE_STATUS } from './graph-client';
import { WhatsAppErrorCode } from './whatsapp-enums';

const KIND_BY_ERROR_CODE = new Map<number, ChannelErrorKind>([
  [WhatsAppErrorCode.WindowClosed, ChannelErrorKind.WindowClosed],
  [WhatsAppErrorCode.RateLimitedThroughput, ChannelErrorKind.RateLimited],
  [WhatsAppErrorCode.RateLimitedTier, ChannelErrorKind.RateLimited],
  [WhatsAppErrorCode.RateLimitedApp, ChannelErrorKind.RateLimited],
  [WhatsAppErrorCode.RateLimitedUser, ChannelErrorKind.RateLimited],
  [WhatsAppErrorCode.NumberRestricted, ChannelErrorKind.Restricted],
  [WhatsAppErrorCode.AccountDisabled, ChannelErrorKind.Restricted],
  [WhatsAppErrorCode.PhoneNumberNotRegistered, ChannelErrorKind.Restricted],
  [WhatsAppErrorCode.DeliveryFailed, ChannelErrorKind.DeliveryFailed],
  [WhatsAppErrorCode.RecipientIsSender, ChannelErrorKind.DeliveryFailed],
  [WhatsAppErrorCode.MediaUploadNotAccepted, ChannelErrorKind.MediaRejected],
  [WhatsAppErrorCode.UnsupportedType, ChannelErrorKind.MediaRejected],
  [WhatsAppErrorCode.AuthOAuth, ChannelErrorKind.Auth],
]);

const ERROR_TEXT_BY_KIND: Record<ChannelErrorKind, string> = {
  [ChannelErrorKind.WindowClosed]: 'the 24-hour customer-service window is closed',
  [ChannelErrorKind.RateLimited]: 'the WhatsApp channel is busy, try again shortly',
  [ChannelErrorKind.Restricted]: 'the WhatsApp number is restricted by Meta',
  [ChannelErrorKind.DeliveryFailed]: 'delivery failed',
  [ChannelErrorKind.ReactionRejected]: 'the reaction was rejected',
  [ChannelErrorKind.MediaRejected]: 'the media was rejected',
  [ChannelErrorKind.TemplateRejected]: 'the template was rejected',
  [ChannelErrorKind.Timeout]: 'the WhatsApp channel did not answer in time',
  [ChannelErrorKind.Auth]: 'the WhatsApp credentials were refused',
  [ChannelErrorKind.Unknown]: 'the WhatsApp channel returned an unexpected error',
};

function resolveKind(input: {
  status: number;
  errorCode: number | null;
  isTemplateSend: boolean;
  isReactionSend: boolean;
}): ChannelErrorKind {
  const { status, errorCode, isTemplateSend, isReactionSend } = input;
  const isReactionRejection = isReactionSend && errorCode === WhatsAppErrorCode.ReactionTargetInvalid;
  if (isReactionRejection) return ChannelErrorKind.ReactionRejected;
  const tabledKind = errorCode === null ? undefined : KIND_BY_ERROR_CODE.get(errorCode);
  if (tabledKind !== undefined) return tabledKind;
  if (status === HttpStatus.Unauthorized) return ChannelErrorKind.Auth;
  const isTimeout = status === GRAPH_NO_RESPONSE_STATUS || status >= HttpStatus.InternalServerError;
  if (isTimeout) return ChannelErrorKind.Timeout;
  if (isTemplateSend) return ChannelErrorKind.TemplateRejected;
  return ChannelErrorKind.Unknown;
}

export function mapGraphErrorToChannelError(input: {
  status: number;
  errorCode: number | null;
  errorTitle: string | null;
  message: string;
  isTemplateSend: boolean;
  isReactionSend: boolean;
}): ChannelError {
  const kind = resolveKind(input);
  return new ChannelError({ kind, message: `${ERROR_TEXT_BY_KIND[kind]} (${input.message})`, errorCode: input.errorCode });
}

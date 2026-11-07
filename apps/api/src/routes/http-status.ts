import { ChannelErrorKind, HttpStatus, InboxErrorCode } from '@zapbip/types';

export { HttpStatus };

export type ErrorHttpStatus = Exclude<HttpStatus, HttpStatus.SwitchingProtocols>;

export const ERROR_STATUS: Record<InboxErrorCode | ChannelErrorKind, ErrorHttpStatus> = {
  [InboxErrorCode.InvalidInput]: HttpStatus.BadRequest,
  [InboxErrorCode.NotFound]: HttpStatus.NotFound,
  [InboxErrorCode.UploadExpired]: HttpStatus.Gone,
  [InboxErrorCode.UploadUnavailable]: HttpStatus.Conflict,
  [ChannelErrorKind.DeliveryFailed]: HttpStatus.BadGateway,
};

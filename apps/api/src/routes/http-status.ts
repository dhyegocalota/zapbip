import { ChannelErrorKind, InboxErrorCode } from '@zapbip/types';
import { HttpStatus } from '../contract/http-status';

export const ERROR_STATUS: Record<InboxErrorCode | ChannelErrorKind, HttpStatus> = {
  [InboxErrorCode.InvalidInput]: HttpStatus.BadRequest,
  [InboxErrorCode.NotFound]: HttpStatus.NotFound,
  [InboxErrorCode.UploadExpired]: HttpStatus.Gone,
  [InboxErrorCode.UploadUnavailable]: HttpStatus.Conflict,
  [ChannelErrorKind.DeliveryFailed]: HttpStatus.BadGateway,
  [ChannelErrorKind.WindowClosed]: HttpStatus.BadGateway,
  [ChannelErrorKind.RateLimited]: HttpStatus.BadGateway,
  [ChannelErrorKind.Restricted]: HttpStatus.BadGateway,
  [ChannelErrorKind.ReactionRejected]: HttpStatus.BadGateway,
  [ChannelErrorKind.MediaRejected]: HttpStatus.BadGateway,
  [ChannelErrorKind.TemplateRejected]: HttpStatus.BadGateway,
  [ChannelErrorKind.Timeout]: HttpStatus.BadGateway,
  [ChannelErrorKind.Auth]: HttpStatus.BadGateway,
  [ChannelErrorKind.Unknown]: HttpStatus.BadGateway,
};

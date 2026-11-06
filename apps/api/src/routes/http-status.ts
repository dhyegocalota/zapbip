import { ChannelErrorKind, InboxErrorCode } from '@zapbip/types';

export enum HttpStatus {
  Ok = 200,
  Created = 201,
  MultipleChoices = 300,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  Gone = 410,
  LengthRequired = 411,
  PayloadTooLarge = 413,
  UnsupportedMediaType = 415,
  InternalServerError = 500,
  BadGateway = 502,
  ServiceUnavailable = 503,
}

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

import { ChannelErrorKind, type InboxErrorCode, type TemplateKind } from '@zapbip/types';
import { NOTICE_FAILED_MESSAGE } from './constants';

export class InboxError extends Error {
  readonly code: InboxErrorCode | ChannelErrorKind;

  constructor(input: { code: InboxErrorCode | ChannelErrorKind; message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

export class ChannelError extends InboxError {
  readonly errorCode: number | null;

  constructor(input: { kind: ChannelErrorKind; message: string; errorCode: number | null }) {
    super({ code: input.kind, message: input.message });
    this.errorCode = input.errorCode;
  }
}

export class NoticeFailedError extends InboxError {
  readonly templateKind: TemplateKind;

  constructor(input: { templateKind: TemplateKind }) {
    super({ code: ChannelErrorKind.DeliveryFailed, message: NOTICE_FAILED_MESSAGE });
    this.templateKind = input.templateKind;
  }
}

import { ChannelErrorKind, type InboxErrorCode, type TemplateKind } from '@zapbip/types';

export class InboxError extends Error {
  readonly code: InboxErrorCode | ChannelErrorKind;

  constructor(input: { code: InboxErrorCode | ChannelErrorKind; message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

export class NoticeFailedError extends InboxError {
  readonly templateKind: TemplateKind;

  constructor(input: { templateKind: TemplateKind }) {
    super({ code: ChannelErrorKind.DeliveryFailed, message: 'delivery failed for notice' });
    this.templateKind = input.templateKind;
  }
}

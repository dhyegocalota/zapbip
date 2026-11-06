import type { ChannelErrorKind, InboxErrorCode } from '@zapbip/types';

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

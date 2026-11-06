import type { ChannelErrorKind, InboxErrorCode } from '@zapbip/types';

export class InboxError extends Error {
  readonly code: InboxErrorCode | ChannelErrorKind;

  constructor(input: { code: InboxErrorCode | ChannelErrorKind; message: string }) {
    super(input.message);
    this.code = input.code;
  }
}

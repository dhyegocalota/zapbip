import type { ChannelError } from '@zapbip/core';

export function mapGraphErrorToChannelError(input: {
  status: number;
  errorCode: number | null;
  errorTitle: string | null;
  message: string;
  isTemplateSend: boolean;
}): ChannelError {
  void input;
  throw new Error('mapGraphErrorToChannelError is not implemented');
}

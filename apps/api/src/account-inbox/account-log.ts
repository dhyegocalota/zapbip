import type { ReceiveAccountMessageResult } from '@zapbip/core';
import type { LogFields } from '../contract/log';

export function logFieldsOfAccountResult(input: { result: ReceiveAccountMessageResult; accountId: string; locale: string }): LogFields[] {
  throw new Error(`logFieldsOfAccountResult is not implemented for ${input.accountId}`);
}

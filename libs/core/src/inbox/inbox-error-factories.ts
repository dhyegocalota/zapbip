import { InboxErrorCode } from '@zapbip/types';
import { InboxError } from './errors';

export function invalidInput(input: { message: string }): InboxError {
  return new InboxError({ code: InboxErrorCode.InvalidInput, message: input.message });
}

export function notFound(input: { message: string }): InboxError {
  return new InboxError({ code: InboxErrorCode.NotFound, message: input.message });
}

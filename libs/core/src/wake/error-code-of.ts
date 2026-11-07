import { InboxError } from '../inbox/errors';

export function errorCodeOf(input: { error: unknown }): string {
  const { error } = input;
  if (!(error instanceof InboxError)) throw error;
  return error.code;
}

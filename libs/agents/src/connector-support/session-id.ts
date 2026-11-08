import { UUID_PATTERN } from '@zapbip/types';

export function assertSessionId(input: { sessionId: string }): void {
  if (!UUID_PATTERN.test(input.sessionId)) throw new Error('session id is not a UUID');
}

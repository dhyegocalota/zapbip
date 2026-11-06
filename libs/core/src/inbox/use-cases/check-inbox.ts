import type { CheckInboxInput, CheckInboxResult } from './types';

export function checkInbox(input: CheckInboxInput): Promise<CheckInboxResult> {
  void input;
  throw new Error('checkInbox is not implemented');
}

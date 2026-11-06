import type { CheckInboxInput, CheckInboxResult } from '../inbox/use-cases/types';
import type { WakeContext } from './wake-ports';

export function pollInbox(input: CheckInboxInput & Pick<WakeContext, 'wake'>): Promise<CheckInboxResult> {
  void input;
  throw new Error('pollInbox is not implemented');
}

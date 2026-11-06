import type { WakeOutcome } from '@zapbip/types';
import type { ScheduleWakeInput } from './wake-ports';

export function scheduleWake(input: ScheduleWakeInput): Promise<WakeOutcome> {
  void input;
  throw new Error('scheduleWake is not implemented');
}

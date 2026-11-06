import type { ScheduledWake } from './wake-setting';

export function isPollerStale(input: { wake: ScheduledWake; now: number }): boolean {
  void input;
  throw new Error('isPollerStale is not implemented');
}

export function pollerDeadline(input: { wake: ScheduledWake }): number | null {
  void input;
  throw new Error('pollerDeadline is not implemented');
}

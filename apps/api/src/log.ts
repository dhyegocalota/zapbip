import type { LogFields } from './contract/log';

export function logEvent(fields: LogFields): void {
  void fields;
  throw new Error('logEvent is not implemented');
}

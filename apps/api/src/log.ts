import type { LogFields } from './contract/log';

export function logEvent(fields: LogFields): void {
  console.log(JSON.stringify(fields));
}

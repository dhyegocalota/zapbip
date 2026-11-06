import type { Bindings } from '../contract/env';

enum WaitlistFlag {
  Enabled = 'true',
  Disabled = 'false',
}

export function readWaitlistEnabled(input: { bindings: Bindings }): boolean {
  const flag = input.bindings.WAITLIST_ENABLED;
  if (flag === WaitlistFlag.Enabled) return true;
  if (flag === WaitlistFlag.Disabled) return false;
  throw new Error(`WAITLIST_ENABLED must be ${WaitlistFlag.Enabled} or ${WaitlistFlag.Disabled}`);
}

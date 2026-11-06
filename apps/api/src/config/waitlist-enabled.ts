import type { Bindings } from '../contract/env';

export function readWaitlistEnabled(input: { bindings: Bindings }): boolean {
  throw new Error(`readWaitlistEnabled is not implemented for ${input.bindings.WAITLIST_ENABLED}`);
}

import type { WakeRefusalKind } from '@zapbip/types';

export class WakeIsolationRefusedError extends Error {
  constructor(readonly kind: WakeRefusalKind) {
    super(kind);
  }
}

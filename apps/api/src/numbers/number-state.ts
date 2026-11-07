import type { WhatsAppNumberState } from '@zapbip/types';

export function assertNumberTransition(_input: { from: WhatsAppNumberState; to: WhatsAppNumberState; verifiedAt: number | null }): void {
  throw new Error('assertNumberTransition is not implemented');
}

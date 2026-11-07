import { WhatsAppNumberState } from '@zapbip/types';

const ALLOWED_TRANSITIONS: Record<WhatsAppNumberState, WhatsAppNumberState[]> = {
  [WhatsAppNumberState.Pending]: [WhatsAppNumberState.Active],
  [WhatsAppNumberState.Active]: [WhatsAppNumberState.Closed, WhatsAppNumberState.Disabled],
  [WhatsAppNumberState.Closed]: [WhatsAppNumberState.Active, WhatsAppNumberState.Disabled],
  [WhatsAppNumberState.Disabled]: [WhatsAppNumberState.Closed],
};

export function assertNumberTransition(input: { from: WhatsAppNumberState; to: WhatsAppNumberState; verifiedAt: number | null }): void {
  const { from, to, verifiedAt } = input;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) throw new Error(`transition ${from} → ${to} is not allowed`);
  const isActivatingUnverified = from === WhatsAppNumberState.Pending && verifiedAt === null;
  if (isActivatingUnverified) throw new Error(`transition ${from} → ${to} is not allowed: the number is not verified`);
}

export function allowedTargetsOf(input: { from: WhatsAppNumberState; verifiedAt: number | null }): WhatsAppNumberState[] {
  const isUnverifiedPending = input.from === WhatsAppNumberState.Pending && input.verifiedAt === null;
  return isUnverifiedPending ? [] : ALLOWED_TRANSITIONS[input.from];
}

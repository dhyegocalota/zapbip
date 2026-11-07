import { WhatsAppNumberState } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { assertNumberTransition } from '../../src/numbers/number-state';

const VERIFIED_AT = 1_700_000_000_000;
const { Pending, Active, Closed, Disabled } = WhatsAppNumberState;

const ALLOWED: [WhatsAppNumberState, WhatsAppNumberState][] = [
  [Pending, Active],
  [Active, Closed],
  [Closed, Active],
  [Active, Disabled],
  [Closed, Disabled],
  [Disabled, Closed],
];

const REFUSED = Object.values(WhatsAppNumberState)
  .flatMap((from) => Object.values(WhatsAppNumberState).map((to): [WhatsAppNumberState, WhatsAppNumberState] => [from, to]))
  .filter(([from, to]) => !ALLOWED.some(([allowedFrom, allowedTo]) => allowedFrom === from && allowedTo === to));

describe('number state transitions', () => {
  it.each(ALLOWED)('allows %s → %s', (from, to) => {
    expect(() => assertNumberTransition({ from, to, verifiedAt: VERIFIED_AT })).not.toThrow();
  });

  it.each(REFUSED)('refuses %s → %s', (from, to) => {
    expect(() => assertNumberTransition({ from, to, verifiedAt: VERIFIED_AT })).toThrow(`transition ${from} → ${to} is not allowed`);
  });

  it('refuses pending → active while the number is not verified', () => {
    expect(() => assertNumberTransition({ from: Pending, to: Active, verifiedAt: null })).toThrow('is not verified');
  });
});

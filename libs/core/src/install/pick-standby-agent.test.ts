import { WakeMode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { pickStandbyAgent, type StandbyCandidate } from './pick-standby-agent';

function candidate(input: { agent: string; createdAt: number; wakeMode: WakeMode }): StandbyCandidate {
  return input;
}

describe('pickStandbyAgent', () => {
  test('picks the newest eligible candidate and never the agent itself or none', () => {
    const candidates = [
      candidate({ agent: 'idle', createdAt: 9, wakeMode: WakeMode.None }),
      candidate({ agent: 'self', createdAt: 7, wakeMode: WakeMode.Webhook }),
      candidate({ agent: 'older-local', createdAt: 2, wakeMode: WakeMode.Local }),
      candidate({ agent: 'newest-webhook', createdAt: 5, wakeMode: WakeMode.Webhook }),
    ];
    expect(pickStandbyAgent({ agent: 'self', candidates })).toBe('newest-webhook');
  });

  test('returns null when no candidate is eligible', () => {
    const candidates = [candidate({ agent: 'idle', createdAt: 9, wakeMode: WakeMode.None })];
    expect(pickStandbyAgent({ agent: 'self', candidates })).toBeNull();
    expect(pickStandbyAgent({ agent: 'self', candidates: [] })).toBeNull();
  });

  test('a tie keeps the first listed', () => {
    const candidates = [
      candidate({ agent: 'first', createdAt: 5, wakeMode: WakeMode.Webhook }),
      candidate({ agent: 'second', createdAt: 5, wakeMode: WakeMode.Local }),
    ];
    expect(pickStandbyAgent({ agent: 'self', candidates })).toBe('first');
  });

  test('the wake mode decides, never the reported client name', () => {
    const candidates = [candidate({ agent: 'local-webhook', createdAt: 1, wakeMode: WakeMode.Webhook })];
    expect(pickStandbyAgent({ agent: 'self', candidates })).toBe('local-webhook');
    expect(
      pickStandbyAgent({ agent: 'self', candidates: [candidate({ agent: 'local-none', createdAt: 1, wakeMode: WakeMode.None })] }),
    ).toBeNull();
  });
});

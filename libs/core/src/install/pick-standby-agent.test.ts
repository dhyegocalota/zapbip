import { WakeMode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { pickStandbyAgent, type StandbyCandidate } from './pick-standby-agent';

const LOCAL_WAKE_MODE = 'local' as WakeMode;

function candidate(input: { agent: string; createdAt: number; wakeMode: WakeMode }): StandbyCandidate {
  return input;
}

describe('pickStandbyAgent', () => {
  test('picks the newest eligible candidate and never the agent itself, standby or none', () => {
    const candidates = [
      candidate({ agent: 'idle', createdAt: 9, wakeMode: WakeMode.None }),
      candidate({ agent: 'standing-by', createdAt: 8, wakeMode: WakeMode.Standby }),
      candidate({ agent: 'self', createdAt: 7, wakeMode: WakeMode.Webhook }),
      candidate({ agent: 'older-local', createdAt: 2, wakeMode: LOCAL_WAKE_MODE }),
      candidate({ agent: 'newest-webhook', createdAt: 5, wakeMode: WakeMode.Webhook }),
    ];
    expect(pickStandbyAgent({ agent: 'self', candidates })).toBe('newest-webhook');
  });

  test('returns null when no candidate is eligible', () => {
    const candidates = [
      candidate({ agent: 'idle', createdAt: 9, wakeMode: WakeMode.None }),
      candidate({ agent: 'scheduled', createdAt: 8, wakeMode: WakeMode.Scheduled }),
      candidate({ agent: 'standing-by', createdAt: 7, wakeMode: WakeMode.Standby }),
    ];
    expect(pickStandbyAgent({ agent: 'self', candidates })).toBeNull();
    expect(pickStandbyAgent({ agent: 'self', candidates: [] })).toBeNull();
  });

  test('a tie keeps the first listed', () => {
    const candidates = [
      candidate({ agent: 'first', createdAt: 5, wakeMode: WakeMode.Webhook }),
      candidate({ agent: 'second', createdAt: 5, wakeMode: LOCAL_WAKE_MODE }),
    ];
    expect(pickStandbyAgent({ agent: 'self', candidates })).toBe('first');
  });

  test('the wake mode decides, never the reported client name', () => {
    const candidates = [candidate({ agent: 'cursor-webhook', createdAt: 1, wakeMode: WakeMode.Webhook })];
    expect(pickStandbyAgent({ agent: 'self', candidates })).toBe('cursor-webhook');
    expect(
      pickStandbyAgent({ agent: 'self', candidates: [candidate({ agent: 'cursor-none', createdAt: 1, wakeMode: WakeMode.None })] }),
    ).toBeNull();
  });
});

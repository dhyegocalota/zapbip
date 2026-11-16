import { ONBOARDING_PIN_PATTERN } from '@zapbip/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateTwoStepPin } from '../../src/numbers/two-step-pin';

const SAMPLE_COUNT = 200;
const SMALL_SAMPLE = 42;
const OUT_OF_RANGE_SAMPLE = 4_294_500_000;
const REDRAWN_SAMPLE = 1_000_123;

function stubRandom(input: { samples: number[] }): void {
  const remaining = [...input.samples];
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(<Buffer extends ArrayBufferView | null>(buffer: Buffer): Buffer => {
    const sample = remaining.shift();
    if (sample === undefined) throw new Error('the random source ran out of samples');
    (buffer as unknown as Uint32Array)[0] = sample;
    return buffer;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('the generated two-step PIN', () => {
  it('is always six digits', () => {
    const pins = Array.from({ length: SAMPLE_COUNT }, () => generateTwoStepPin());
    expect(pins.every((pin) => ONBOARDING_PIN_PATTERN.test(pin))).toBe(true);
  });

  it('keeps leading zeros', () => {
    stubRandom({ samples: [SMALL_SAMPLE] });
    expect(generateTwoStepPin()).toBe('000042');
  });

  it('redraws a sample that would bias the range', () => {
    stubRandom({ samples: [OUT_OF_RANGE_SAMPLE, REDRAWN_SAMPLE] });
    expect(generateTwoStepPin()).toBe('000123');
  });
});

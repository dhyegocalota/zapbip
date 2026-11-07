import { describe, expect, it } from 'vitest';
import { readWaitlistEnabled } from '../../src/config/waitlist-enabled';
import type { Bindings } from '../../src/contract/env';

function bindingsWith(input: { value: string | undefined }): Bindings {
  return { WAITLIST_ENABLED: input.value } as unknown as Bindings;
}

describe('readWaitlistEnabled', () => {
  it('reads true', () => {
    expect(readWaitlistEnabled({ bindings: bindingsWith({ value: 'true' }) })).toBe(true);
  });

  it('reads false', () => {
    expect(readWaitlistEnabled({ bindings: bindingsWith({ value: 'false' }) })).toBe(false);
  });

  it.each(['TRUE', '1', '', 'yes', undefined])('refuses %s instead of guessing', (value) => {
    expect(() => readWaitlistEnabled({ bindings: bindingsWith({ value }) })).toThrow('WAITLIST_ENABLED');
  });
});

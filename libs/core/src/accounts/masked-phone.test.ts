import { describe, expect, it } from 'vitest';
import { maskedPhoneOf } from './masked-phone';

describe('maskedPhoneOf', () => {
  it.each([
    ['5511900000051', '+55 ••••-0051'],
    ['14155550100', '+14 ••••-0100'],
  ])('masks %s as %s', (waId, expected) => {
    expect(maskedPhoneOf({ waId })).toBe(expected);
  });

  it('never returns the full number', () => {
    expect(maskedPhoneOf({ waId: '5511900000051' })).not.toContain('5511900000051');
  });
});

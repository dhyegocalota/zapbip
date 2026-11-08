import { OwnerLocale, START_PREFILLED_TEXT } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { startLinkTarget } from '../../src/routes/start-link-target';

const DISPLAY_NUMBER = '+55 11 97777-0000';
const DIGITS = '5511977770000';
const REJECTED_DISPLAY_NUMBERS = [
  '',
  '5511977770000',
  '+123456',
  '+1234567890123456',
  '+5511abc77770000',
  '+5511977770000/../evil',
  '+5511977770000?text=x',
  '+5511977770000#x',
  '+5511977770000\n',
  '@evil.example',
  '//evil.example',
  '+ 5511977770000',
];

describe('startLinkTarget', () => {
  it.each(Object.values(OwnerLocale))('builds the wa.me link with the fixed text of %s', (locale) => {
    const target = startLinkTarget({ displayNumber: '+5511977770000', locale });
    expect(target).toBe(`https://wa.me/${DIGITS}?text=${encodeURIComponent(START_PREFILLED_TEXT[locale])}`);
  });

  it('accepts the shortest and the longest valid number', () => {
    expect(startLinkTarget({ displayNumber: '+1234567', locale: OwnerLocale.EnglishUs })).toMatch(/^https:\/\/wa\.me\/1234567\?text=/);
    expect(startLinkTarget({ displayNumber: '+123456789012345', locale: OwnerLocale.EnglishUs })).toMatch(
      /^https:\/\/wa\.me\/123456789012345\?text=/,
    );
  });

  it.each([...REJECTED_DISPLAY_NUMBERS, DISPLAY_NUMBER])('rejects the display number %j', (displayNumber) => {
    expect(startLinkTarget({ displayNumber, locale: OwnerLocale.EnglishUs })).toBeNull();
  });
});

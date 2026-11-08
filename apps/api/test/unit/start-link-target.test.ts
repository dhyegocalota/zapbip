import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { startLinkTarget } from '../../src/routes/start-link-target';

const SPACED_DISPLAY_NUMBER = '+55 11 97777-0000';
const DIGITS = '5511977770000';
const ENCODED_TEXT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Oi!%20Quero%20conectar%20meus%20agentes%20de%20IA%20ao%20zapbip.',
  [OwnerLocale.EnglishUs]: 'Hi!%20I%20want%20to%20connect%20my%20AI%20agents%20to%20zapbip.',
};
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
  it.each(Object.entries(ENCODED_TEXT))('builds the wa.me link with the fixed text of %s', (locale, encodedText) => {
    expect(startLinkTarget({ displayNumber: '+5511977770000', locale: locale as OwnerLocale })).toBe(
      `https://wa.me/${DIGITS}?text=${encodedText}`,
    );
  });

  it('accepts the shortest and the longest valid number', () => {
    expect(startLinkTarget({ displayNumber: '+1234567', locale: OwnerLocale.EnglishUs })).toMatch(/^https:\/\/wa\.me\/1234567\?text=/);
    expect(startLinkTarget({ displayNumber: '+123456789012345', locale: OwnerLocale.EnglishUs })).toMatch(
      /^https:\/\/wa\.me\/123456789012345\?text=/,
    );
  });

  it.each([...REJECTED_DISPLAY_NUMBERS, SPACED_DISPLAY_NUMBER])('rejects the display number %j', (displayNumber) => {
    expect(startLinkTarget({ displayNumber, locale: OwnerLocale.EnglishUs })).toBeNull();
  });
});

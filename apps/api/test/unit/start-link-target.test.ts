import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { startLinkTarget } from '../../src/routes/start-link-target';

const SPACED_DISPLAY_NUMBER = '+55 11 97777-0000';
const DIGITS = '5511977770000';
const ENCODED_TEXT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Oi!%20Quero%20conectar%20meus%20agentes%20de%20IA%20ao%20zapbip.',
  [OwnerLocale.EnglishUs]: 'Hi!%20I%20want%20to%20connect%20my%20AI%20agents%20to%20zapbip.',
  [OwnerLocale.Spanish]: '%C2%A1Hola!%20Quiero%20conectar%20mis%20agentes%20de%20IA%20a%20zapbip.',
  [OwnerLocale.German]: 'Hallo!%20Ich%20m%C3%B6chte%20meine%20KI-Agenten%20mit%20zapbip%20verbinden.',
  [OwnerLocale.French]: 'Bonjour%E2%80%AF!%20Je%20veux%20connecter%20mes%20agents%20IA%20%C3%A0%20zapbip.',
  [OwnerLocale.Japanese]:
    '%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%EF%BC%81AI%E3%82%A8%E3%83%BC%E3%82%B8%E3%82%A7%E3%83%B3%E3%83%88%E3%82%92zapbip%E3%81%AB%E3%81%A4%E3%81%AA%E3%81%8E%E3%81%9F%E3%81%84%E3%81%A7%E3%81%99%E3%80%82',
  [OwnerLocale.Korean]:
    '%EC%95%88%EB%85%95%ED%95%98%EC%84%B8%EC%9A%94!%20%EC%A0%9C%20AI%20%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8%EB%A5%BC%20zapbip%EC%97%90%20%EC%97%B0%EA%B2%B0%ED%95%98%EA%B3%A0%20%EC%8B%B6%EC%96%B4%EC%9A%94.',
  [OwnerLocale.ChineseSimplified]:
    '%E4%BD%A0%E5%A5%BD%EF%BC%81%E6%88%91%E6%83%B3%E6%8A%8A%E6%88%91%E7%9A%84%20AI%20%E6%99%BA%E8%83%BD%E4%BD%93%E8%BF%9E%E6%8E%A5%E5%88%B0%20zapbip%E3%80%82',
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

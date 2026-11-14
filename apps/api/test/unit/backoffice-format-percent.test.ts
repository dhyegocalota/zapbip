import { WebLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { formatPercent } from '../../src/backoffice/format-percent';

describe('formatPercent', () => {
  it.each([
    { percent: 66.66666, text: '66.7%' },
    { percent: 75, text: '75.0%' },
    { percent: 0, text: '0.0%' },
    { percent: 100, text: '100.0%' },
  ])('renders $percent as $text', ({ percent, text }) => {
    expect(formatPercent({ percent, locale: WebLocale.PortugueseBrazil })).toBe(text);
    expect(formatPercent({ percent, locale: WebLocale.EnglishUs })).toBe(text);
  });
});

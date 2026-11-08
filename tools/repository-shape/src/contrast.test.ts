import { describe, expect, test } from 'vitest';
import { compositeOver, contrastOf, themeTokens } from './contrast';

const MAXIMUM_CONTRAST = 21;
const BRAND_ON_WHITE_CONTRAST = 4.14;
const CONTRAST_PRECISION = 2;
const COMPOSITED_WHITE_CHANNEL = 224;

function channelsOf(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

describe('contrast helper', () => {
  test('black on white is the maximum ratio', () => {
    expect(contrastOf({ foreground: '#000000', background: '#FFFFFF' })).toBeCloseTo(MAXIMUM_CONTRAST, CONTRAST_PRECISION);
  });

  test('the ratio does not depend on which colour is the foreground', () => {
    expect(contrastOf({ foreground: '#FFFFFF', background: '#000000' })).toBeCloseTo(MAXIMUM_CONTRAST, CONTRAST_PRECISION);
  });

  test('the brand green on white is 4.14', () => {
    expect(contrastOf({ foreground: '#128C7E', background: '#FFFFFF' })).toBeCloseTo(BRAND_ON_WHITE_CONTRAST, CONTRAST_PRECISION);
  });

  test('a translucent white over black composites to channel 224', () => {
    const composite = compositeOver({ colour: 'rgb(255 255 255 / 0.88)', backdrop: '#000000' });
    expect(channelsOf(composite)).toEqual([COMPOSITED_WHITE_CHANNEL, COMPOSITED_WHITE_CHANNEL, COMPOSITED_WHITE_CHANNEL]);
  });

  test('a translucent foreground is measured over its background', () => {
    expect(contrastOf({ foreground: 'rgb(255 255 255 / 1)', background: '#000000' })).toBeCloseTo(MAXIMUM_CONTRAST, CONTRAST_PRECISION);
  });

  test('an unparsable value throws naming it', () => {
    expect(() => contrastOf({ foreground: 'var(--missing)', background: '#FFFFFF' })).toThrow('var(--missing)');
  });

  test('the dark theme is the light tokens overridden by the second root block', () => {
    const stylesheet = ':root { --a: #111111; --b: #222222; } @media (prefers-color-scheme: dark) { :root { --b: #333333; } }';
    expect(themeTokens({ stylesheet })).toEqual({
      light: { '--a': '#111111', '--b': '#222222' },
      dark: { '--a': '#111111', '--b': '#333333' },
    });
  });

  test('a stylesheet without two root blocks throws', () => {
    expect(() => themeTokens({ stylesheet: ':root { --a: #111111; }' })).toThrow('light and a dark token block');
  });
});

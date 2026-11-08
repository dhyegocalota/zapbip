import { describe, expect, test } from 'vitest';
import { compositeOver, contrastOf, themeTokens } from './contrast';
import { readRepositoryFile } from './repository-files';

const STYLESHEET = readRepositoryFile('apps/api/src/backoffice/assets/backoffice.css');
const TEXT_CONTRAST = 4.5;
const NON_TEXT_CONTRAST = 3;
const COLOUR_FUNCTION_PATTERN = /rgb\([^)]*\)/;
const DARKEST_CONTENT = '#000000';
const SURFACES = ['--color-page', '--color-surface', '--color-sunken', '--color-raised'];

type Pair = { foreground: string; background: string; minimum: number };
type Tokens = Record<string, string>;

function pairsOf({ foregrounds, backgrounds, minimum }: { foregrounds: string[]; backgrounds: string[]; minimum: number }): Pair[] {
  return foregrounds.flatMap((foreground) => backgrounds.map((background) => ({ foreground, background, minimum })));
}

const PAIRS: Pair[] = [
  ...pairsOf({
    foregrounds: ['--color-text'],
    backgrounds: [...SURFACES, '--color-success-surface', '--color-info-surface'],
    minimum: TEXT_CONTRAST,
  }),
  ...pairsOf({
    foregrounds: ['--color-text-muted'],
    backgrounds: ['--color-page', '--color-surface', '--color-sunken'],
    minimum: TEXT_CONTRAST,
  }),
  ...pairsOf({
    foregrounds: ['--color-action'],
    backgrounds: ['--color-page', '--color-surface', '--color-sunken', '--color-success-surface'],
    minimum: TEXT_CONTRAST,
  }),
  ...pairsOf({ foregrounds: ['--color-on-action'], backgrounds: ['--color-action', '--color-action-hover'], minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-danger'], backgrounds: ['--color-surface', '--color-danger-surface'], minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-on-danger'], backgrounds: ['--color-danger'], minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-warning'], backgrounds: ['--color-surface', '--color-warning-surface'], minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-border-control'], backgrounds: ['--color-surface', '--color-page'], minimum: NON_TEXT_CONTRAST }),
  ...pairsOf({
    foregrounds: ['--color-brand'],
    backgrounds: ['--color-surface', '--color-page', '--color-sunken'],
    minimum: NON_TEXT_CONTRAST,
  }),
  ...pairsOf({ foregrounds: ['--color-focus'], backgrounds: ['--color-surface', '--color-page'], minimum: NON_TEXT_CONTRAST }),
];

function tokenOf({ tokens, name }: { tokens: Tokens; name: string }): string {
  const value = tokens[name];
  if (value === undefined) throw new Error(`the stylesheet does not define ${name}`);
  return value;
}

function shortfallsOf({ pairs, tokens }: { pairs: Pair[]; tokens: Tokens }): string[] {
  return pairs
    .filter(
      ({ foreground, background, minimum }) =>
        contrastOf({ foreground: tokenOf({ tokens, name: foreground }), background: tokenOf({ tokens, name: background }) }) < minimum,
    )
    .map(({ foreground, background }) => `${foreground} on ${background}`);
}

function pageWithGlow({ tokens }: { tokens: Tokens }): string {
  const glow = tokenOf({ tokens, name: '--gradient-page' }).match(COLOUR_FUNCTION_PATTERN);
  if (glow === null) throw new Error('--gradient-page holds no colour');
  return compositeOver({ colour: glow[0], backdrop: tokenOf({ tokens, name: '--color-page' }) });
}

describe('backoffice contrast', () => {
  test.each(['light', 'dark'] as const)('meets the contrast of the design in %s', (theme) => {
    expect(shortfallsOf({ pairs: PAIRS, tokens: themeTokens({ stylesheet: STYLESHEET })[theme] })).toEqual([]);
  });

  test.each(['light', 'dark'] as const)('keeps the text readable on the page glow in %s', (theme) => {
    const tokens = themeTokens({ stylesheet: STYLESHEET })[theme];
    const glowTokens = { ...tokens, '--color-glow-page': pageWithGlow({ tokens }) };
    const pairs = pairsOf({
      foregrounds: ['--color-text-muted', '--color-action'],
      backgrounds: ['--color-glow-page'],
      minimum: TEXT_CONTRAST,
    });
    expect(shortfallsOf({ pairs, tokens: glowTokens })).toEqual([]);
  });

  test.each(['light', 'dark'] as const)('keeps the header text readable over the darkest content in %s', (theme) => {
    const tokens = themeTokens({ stylesheet: STYLESHEET })[theme];
    const headerOverContent = compositeOver({ colour: tokenOf({ tokens, name: '--color-header' }), backdrop: DARKEST_CONTENT });
    const pairs = pairsOf({
      foregrounds: ['--color-text', '--color-text-muted'],
      backgrounds: ['--color-header-over-content'],
      minimum: TEXT_CONTRAST,
    });
    expect(shortfallsOf({ pairs, tokens: { ...tokens, '--color-header-over-content': headerOverContent } })).toEqual([]);
  });
});

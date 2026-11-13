import { describe, expect, test } from 'vitest';
import { contrastOf, forcedDarkTokens, themeTokens } from './contrast';
import { readRepositoryFile } from './repository-files';

const SITE_STYLESHEET = readRepositoryFile('apps/api/src/site/assets/site.css');
const BACKOFFICE_STYLESHEET = readRepositoryFile('apps/api/src/backoffice/assets/backoffice.css');
const TEXT_CONTRAST = 4.5;
const NON_TEXT_CONTRAST = 3;
const SURFACES = ['--color-page', '--color-surface', '--color-sunken'];

type Pair = { foreground: string; background: string; minimum: number };
type Tokens = Record<string, string>;

function pairsOf({ foregrounds, backgrounds, minimum }: { foregrounds: string[]; backgrounds: string[]; minimum: number }): Pair[] {
  return foregrounds.flatMap((foreground) => backgrounds.map((background) => ({ foreground, background, minimum })));
}

const PAIRS: Pair[] = [
  ...pairsOf({ foregrounds: ['--color-text', '--color-text-muted'], backgrounds: SURFACES, minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-action'], backgrounds: [...SURFACES, '--color-success-surface'], minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-on-action'], backgrounds: ['--color-action', '--color-action-hover'], minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-danger'], backgrounds: ['--color-surface', '--color-danger-surface'], minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-warning'], backgrounds: ['--color-surface', '--color-warning-surface'], minimum: TEXT_CONTRAST }),
  ...pairsOf({
    foregrounds: ['--color-terminal-text', '--color-terminal-muted', '--color-terminal-accent'],
    backgrounds: ['--color-terminal', '--color-terminal-bar'],
    minimum: TEXT_CONTRAST,
  }),
  ...pairsOf({
    foregrounds: ['--color-band-text', '--color-band-muted', '--color-band-accent'],
    backgrounds: ['--color-band', '--color-band-item'],
    minimum: TEXT_CONTRAST,
  }),
  ...pairsOf({
    foregrounds: ['--color-chat-ink', '--color-chat-sender', '--color-chat-muted'],
    backgrounds: ['--color-chat-incoming', '--color-chat-outgoing'],
    minimum: TEXT_CONTRAST,
  }),
  ...pairsOf({ foregrounds: ['--color-chat-ink'], backgrounds: ['--color-chat-wallpaper'], minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-chat-on-sender'], backgrounds: ['--color-chat-sender'], minimum: TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-border-control'], backgrounds: ['--color-surface', '--color-page'], minimum: NON_TEXT_CONTRAST }),
  ...pairsOf({ foregrounds: ['--color-focus'], backgrounds: ['--color-surface', '--color-page'], minimum: NON_TEXT_CONTRAST }),
];

function shortfallsOf({ pairs, tokens }: { pairs: Pair[]; tokens: Tokens }): string[] {
  return pairs
    .filter(({ foreground, background, minimum }) => {
      const foregroundValue = tokens[foreground];
      const backgroundValue = tokens[background];
      if (foregroundValue === undefined || backgroundValue === undefined)
        throw new Error(`the site stylesheet does not define ${foreground} or ${background}`);
      return contrastOf({ foreground: foregroundValue, background: backgroundValue }) < minimum;
    })
    .map(({ foreground, background }) => `${foreground} on ${background}`);
}

describe('site contrast', () => {
  test.each(['light', 'dark'] as const)('meets the contrast of the design in %s', (theme) => {
    expect(shortfallsOf({ pairs: PAIRS, tokens: themeTokens({ stylesheet: SITE_STYLESHEET })[theme] })).toEqual([]);
  });

  test('meets the contrast of the design in the forced dark block', () => {
    expect(shortfallsOf({ pairs: PAIRS, tokens: forcedDarkTokens({ stylesheet: SITE_STYLESHEET }) })).toEqual([]);
  });

  test.each(['light', 'dark'] as const)('uses the backoffice value of every token it shares in %s', (theme) => {
    const backoffice = themeTokens({ stylesheet: BACKOFFICE_STYLESHEET })[theme];
    const site = themeTokens({ stylesheet: SITE_STYLESHEET })[theme];
    const differing = Object.entries(site)
      .filter(([name]) => backoffice[name] !== undefined)
      .filter(([name, value]) => backoffice[name] !== value)
      .map(([name]) => name);
    expect(differing).toEqual([]);
  });
});

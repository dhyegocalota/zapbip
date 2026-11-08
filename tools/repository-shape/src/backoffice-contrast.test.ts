import { describe, expect, test } from 'vitest';
import { contrastOf, themeTokens } from './contrast';
import { readRepositoryFile } from './repository-files';

const STYLESHEET = readRepositoryFile('apps/api/src/backoffice/assets/backoffice.css');
const TEXT_CONTRAST = 4.5;
const NON_TEXT_CONTRAST = 3;

const CONTRAST_PAIRS: [string, string, number][] = [
  ['--color-text', '--color-page', TEXT_CONTRAST],
  ['--color-text', '--color-surface', TEXT_CONTRAST],
  ['--color-text-muted', '--color-page', TEXT_CONTRAST],
  ['--color-text-muted', '--color-surface', TEXT_CONTRAST],
  ['--color-action', '--color-surface', TEXT_CONTRAST],
  ['--color-action', '--color-page', TEXT_CONTRAST],
  ['--color-on-action', '--color-action', TEXT_CONTRAST],
  ['--color-danger', '--color-surface', TEXT_CONTRAST],
  ['--color-danger', '--color-danger-surface', TEXT_CONTRAST],
  ['--color-warning', '--color-warning-surface', TEXT_CONTRAST],
  ['--color-text', '--color-info-surface', TEXT_CONTRAST],
  ['--color-border-control', '--color-surface', NON_TEXT_CONTRAST],
  ['--color-brand', '--color-surface', NON_TEXT_CONTRAST],
  ['--color-focus', '--color-surface', NON_TEXT_CONTRAST],
];

describe('backoffice contrast', () => {
  test.each(['light', 'dark'] as const)('meets the contrast of the design in %s', (theme) => {
    const tokens = themeTokens({ stylesheet: STYLESHEET })[theme];
    const shortfalls = CONTRAST_PAIRS.filter(
      ([foreground, background, minimum]) => contrastOf({ foreground: tokens[foreground]!, background: tokens[background]! }) < minimum,
    ).map(([foreground, background]) => `${foreground} on ${background}`);
    expect(shortfalls).toEqual([]);
  });
});

import { describe, expect, test } from 'vitest';
import { themeTokens } from './contrast';
import { readRepositoryFile } from './repository-files';

const STYLESHEET = readRepositoryFile('apps/api/src/backoffice/assets/backoffice.css');
const THEMED_TOKEN_PATTERN = /^--(color|shadow|elevation|gradient|glow|pattern)-/;
const FIXED_TOKENS = [
  '--color-signal',
  '--color-danger',
  '--color-danger-surface',
  '--color-warning',
  '--color-warning-surface',
  '--color-focus',
  '--gradient-hero-border',
  '--glow-signal',
  '--glow-signal-faded',
];
const DARK_BLOCK_PATTERN = /@media \(prefers-color-scheme: dark\) \{\s*:root\s*\{[^}]*\}/;

describe('backoffice tokens', () => {
  test('every themed light token is redefined in the dark block', () => {
    const darkBlock = STYLESHEET.match(DARK_BLOCK_PATTERN);
    if (darkBlock === null) throw new Error('the stylesheet has no dark token block');
    const lightNames = Object.keys(themeTokens({ stylesheet: STYLESHEET }).light).filter((name) => THEMED_TOKEN_PATTERN.test(name));
    const missing = lightNames.filter((name) => !FIXED_TOKENS.includes(name) && !darkBlock[0].includes(`${name}:`));
    expect(missing).toEqual([]);
  });
});

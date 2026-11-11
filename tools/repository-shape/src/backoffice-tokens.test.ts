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
const DARK_BLOCK_PATTERN = /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\)\s*\{[^}]*\}/;
const FORCED_DARK_BLOCK_PATTERN = /:root\[data-theme='dark'\]\s*\{[^}]*\}/;
const BLOCK_BODY_PATTERN = /:root[^{]*\{([^}]*)\}/;
const WHITESPACE_PATTERN = /\s+/g;
const BASE_BLOCK_PATTERN = /^:root\s*\{[^}]*\}/m;

describe('backoffice tokens', () => {
  test('every themed light token is redefined in the dark block', () => {
    const darkBlock = STYLESHEET.match(DARK_BLOCK_PATTERN);
    if (darkBlock === null) throw new Error('the stylesheet has no dark token block');
    const lightNames = Object.keys(themeTokens({ stylesheet: STYLESHEET }).light).filter((name) => THEMED_TOKEN_PATTERN.test(name));
    const missing = lightNames.filter((name) => !FIXED_TOKENS.includes(name) && !darkBlock[0].includes(`${name}:`));
    expect(missing).toEqual([]);
  });

  test('the forced dark block is the same palette as the system dark block', () => {
    const systemDark = STYLESHEET.match(DARK_BLOCK_PATTERN);
    const forcedDark = STYLESHEET.match(FORCED_DARK_BLOCK_PATTERN);
    if (systemDark === null || forcedDark === null) throw new Error('the stylesheet needs both dark token blocks');
    const bodyOf = (block: string): string => block.match(BLOCK_BODY_PATTERN)![1]!.replace(WHITESPACE_PATTERN, ' ').trim();
    expect(bodyOf(forcedDark[0])).toBe(bodyOf(systemDark[0]));
  });

  test.each([
    ['the light base', BASE_BLOCK_PATTERN, 'color-scheme: light;'],
    ['the system dark block', DARK_BLOCK_PATTERN, 'color-scheme: dark;'],
    ['the forced dark block', FORCED_DARK_BLOCK_PATTERN, 'color-scheme: dark;'],
  ])('%s sets the native colour scheme', (_name, pattern, declaration) => {
    expect(STYLESHEET.match(pattern)?.[0]).toContain(declaration);
  });
});

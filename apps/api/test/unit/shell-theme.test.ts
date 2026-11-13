import { describe, expect, it } from 'vitest';
import { ShellTheme, resolveTheme } from '../../src/web-shell/shell-theme';

describe('resolveTheme', () => {
  it.each(Object.values(ShellTheme))('keeps the allow-listed cookie value %s', (theme) => {
    expect(resolveTheme({ cookieValue: theme })).toBe(theme);
  });

  it.each([undefined, '', 'DARK', '<script>', 'purple'])('resolves the cookie value %s to system', (cookieValue) => {
    expect(resolveTheme({ cookieValue })).toBe(ShellTheme.System);
  });
});

import { describe, expect, it } from 'vitest';
import { BackofficeTheme, resolveTheme } from '../../src/backoffice/backoffice-theme';

describe('resolveTheme', () => {
  it.each(Object.values(BackofficeTheme))('keeps the allow-listed cookie value %s', (theme) => {
    expect(resolveTheme({ cookieValue: theme })).toBe(theme);
  });

  it.each([undefined, '', 'DARK', '<script>', 'purple'])('resolves the cookie value %s to system', (cookieValue) => {
    expect(resolveTheme({ cookieValue })).toBe(BackofficeTheme.System);
  });
});

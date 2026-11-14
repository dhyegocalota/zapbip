import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { ShellCopyKey } from '../../src/web-shell/shell-copy';
import { SITE_STYLESHEET } from '../../src/site/site-stylesheet';
import { shellCopyHtml, siteFetch } from '../support/site';

const THEME_BUTTONS = [
  ['light', ShellCopyKey.ThemeLight],
  ['dark', ShellCopyKey.ThemeDark],
  ['system', ShellCopyKey.ThemeSystem],
] as const;

describe('the theme switch', () => {
  it.each([
    ['/', OwnerLocale.EnglishUs],
    ['/pt-br', OwnerLocale.PortugueseBrazil],
  ])('shows one small icon per theme on %s, named by its label', async (path, locale) => {
    const html = await (await siteFetch({ path })).text();
    THEME_BUTTONS.forEach(([theme, label]) => {
      const name = shellCopyHtml({ key: label, locale });
      const button = new RegExp(
        `<button type="submit" name="theme" value="${theme}" aria-pressed="(true|false)" aria-label="${name}" title="${name}">(.*?)</button>`,
      ).exec(html);
      expect(button).not.toBeNull();
      expect(button![2]).toMatch(/^<svg class="theme-icon"[^>]*aria-hidden="true"/);
      expect(button![2]).not.toContain(`>${name}<`);
    });
  });
});

describe('the language menu', () => {
  it('drops the line the questions draw under each disclosure', () => {
    expect(SITE_STYLESHEET).toMatch(/\.lang-menu \{[^}]*border-bottom: 0;/);
  });
});

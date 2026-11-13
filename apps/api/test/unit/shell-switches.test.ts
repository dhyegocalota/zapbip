import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { LanguageMenu } from '../../src/web-shell/language-menu';
import { LOCALE_PROFILES, MENU_LOCALES } from '../../src/web-shell/locale-profiles';
import { ShellCopyKey, renderShellCopy } from '../../src/web-shell/shell-copy';
import { ShellTheme } from '../../src/web-shell/shell-theme';
import { ThemeSwitch } from '../../src/web-shell/theme-switch';

const CSRF_TOKEN = 'csrf-token-value';
const HIDDEN_FIELDS = [
  { name: 'csrf', value: CSRF_TOKEN },
  { name: 'returnTo', value: '/metrics' },
];
const SVG_PATTERN = /<svg[^>]*>/g;
const BUTTON_PATTERN = /<button[^>]*>/g;
const LOCALES = Object.values(OwnerLocale);

function renderThemeSwitch(input: { locale: OwnerLocale; theme: ShellTheme }): string {
  return String(ThemeSwitch({ ...input, action: '/theme', hiddenFields: HIDDEN_FIELDS }));
}

function renderLanguageMenu(input: { locale: OwnerLocale }): string {
  return String(LanguageMenu({ ...input, action: '/locale', hiddenFields: HIDDEN_FIELDS }));
}

describe('theme switch', () => {
  it('posts to the given action with the hidden fields', () => {
    const html = renderThemeSwitch({ locale: OwnerLocale.EnglishUs, theme: ShellTheme.System });
    expect(html).toContain('<form method="post" action="/theme" class="switch" aria-label="Theme">');
    expect(html).toContain(`name="csrf" value="${CSRF_TOKEN}"`);
    expect(html).toContain('name="returnTo" value="/metrics"');
  });

  it.each(LOCALES)('labels each icon-only button in %s', (locale) => {
    const labels = [ShellCopyKey.ThemeLight, ShellCopyKey.ThemeDark, ShellCopyKey.ThemeSystem].map((key) =>
      renderShellCopy({ key, locale }),
    );
    const buttons = renderThemeSwitch({ locale, theme: ShellTheme.System }).match(BUTTON_PATTERN)!;
    expect(buttons).toHaveLength(3);
    buttons.forEach((button, index) => expect(button).toContain(`aria-label="${labels[index]}"`));
  });

  it.each(Object.values(ShellTheme))('presses only the %s button when it is the theme', (theme) => {
    const buttons = renderThemeSwitch({ locale: OwnerLocale.EnglishUs, theme }).match(BUTTON_PATTERN)!;
    const pressed = buttons.filter((button) => button.includes('aria-pressed="true"'));
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toContain(`value="${theme}"`);
  });

  it('draws one decorative inline icon per button, in the current colour, with no style attribute', () => {
    const html = renderThemeSwitch({ locale: OwnerLocale.EnglishUs, theme: ShellTheme.Dark });
    const icons = html.match(SVG_PATTERN)!;
    expect(icons).toHaveLength(3);
    icons.forEach((icon) => {
      expect(icon).toContain('aria-hidden="true"');
      expect(icon).toContain('stroke="currentColor"');
      expect(icon).toContain('class="theme-icon"');
    });
    expect(html).not.toContain('style=');
  });
});

describe('language menu', () => {
  it('lists one option per profile, in the profile order, each with a flag and its native name', () => {
    const html = renderLanguageMenu({ locale: OwnerLocale.EnglishUs });
    const values = [...html.matchAll(/name="locale" value="([^"]+)"/g)].map((match) => match[1]);
    expect(values).toEqual(MENU_LOCALES);
    expect(new Set(values)).toEqual(new Set(LOCALES));
    MENU_LOCALES.forEach((locale) => expect(html).toContain(`<span>${LOCALE_PROFILES[locale].nativeName}</span>`));
    expect(html.match(/<svg class="flag"/g)).toHaveLength(LOCALES.length + 1);
  });

  it.each(LOCALES)('marks only %s as current and names the trigger with its code', (locale) => {
    const html = renderLanguageMenu({ locale });
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toContain(
      `aria-label="${renderShellCopy({ key: ShellCopyKey.LocaleLabel, locale })}: ${LOCALE_PROFILES[locale].shortName}"`,
    );
  });

  it('carries the hidden fields in the list form', () => {
    const html = renderLanguageMenu({ locale: OwnerLocale.EnglishUs });
    expect(html).toContain('<form class="lang-list" method="post" action="/locale">');
    expect(html).toContain(`name="csrf" value="${CSRF_TOKEN}"`);
  });
});

describe('shell copy', () => {
  it.each(LOCALES)('has every key in %s, none empty', (locale) => {
    expect(Object.values(ShellCopyKey).filter((key) => renderShellCopy({ key, locale }).length === 0)).toEqual([]);
  });

  it('has a profile for every locale with a distinct short name', () => {
    expect(new Set(LOCALES.map((locale) => LOCALE_PROFILES[locale].shortName)).size).toBe(LOCALES.length);
  });
});

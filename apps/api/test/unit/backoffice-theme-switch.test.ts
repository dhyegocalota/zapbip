import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BackofficeTheme } from '../../src/backoffice/backoffice-theme';
import { LocaleSwitch } from '../../src/backoffice/components/locale-switch';
import { ThemeSwitch } from '../../src/backoffice/components/theme-switch';

const CSRF_TOKEN = 'csrf-token-value';
const SVG_PATTERN = /<svg[^>]*>/g;
const BUTTON_PATTERN = /<button[^>]*>/g;

function renderThemeSwitch(input: { locale: OwnerLocale; theme: BackofficeTheme }): string {
  return String(ThemeSwitch({ ...input, csrfToken: CSRF_TOKEN, returnTo: '/metrics' }));
}

describe('theme switch', () => {
  it('posts to /theme with the token and the return path', () => {
    const html = renderThemeSwitch({ locale: OwnerLocale.EnglishUs, theme: BackofficeTheme.System });
    expect(html).toContain('<form method="post" action="/theme" class="theme-switch" aria-label="Theme">');
    expect(html).toContain(`name="csrf" value="${CSRF_TOKEN}"`);
    expect(html).toContain('name="returnTo" value="/metrics"');
  });

  it.each([
    [OwnerLocale.EnglishUs, ['Light', 'Dark', 'System']],
    [OwnerLocale.PortugueseBrazil, ['Claro', 'Escuro', 'Sistema']],
  ])('labels each icon-only button in %s', (locale, labels) => {
    const buttons = renderThemeSwitch({ locale, theme: BackofficeTheme.System }).match(BUTTON_PATTERN)!;
    expect(buttons).toHaveLength(3);
    buttons.forEach((button, index) => expect(button).toContain(`aria-label="${labels[index]}"`));
  });

  it.each(Object.values(BackofficeTheme))('presses only the %s button when it is the theme', (theme) => {
    const buttons = renderThemeSwitch({ locale: OwnerLocale.EnglishUs, theme }).match(BUTTON_PATTERN)!;
    const pressed = buttons.filter((button) => button.includes('aria-pressed="true"'));
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toContain(`value="${theme}"`);
  });

  it('draws one decorative inline icon per button, in the current colour, with no style attribute', () => {
    const html = renderThemeSwitch({ locale: OwnerLocale.EnglishUs, theme: BackofficeTheme.Dark });
    const icons = html.match(SVG_PATTERN)!;
    expect(icons).toHaveLength(3);
    icons.forEach((icon) => {
      expect(icon).toContain('aria-hidden="true"');
      expect(icon).toContain('focusable="false"');
      expect(icon).toContain('stroke="currentColor"');
      expect(icon).toContain('class="icon"');
    });
    expect(html).not.toContain('style=');
  });
});

describe('language switch icon', () => {
  it('shows one decorative globe before the two language buttons', () => {
    const html = String(LocaleSwitch({ locale: OwnerLocale.EnglishUs, csrfToken: CSRF_TOKEN, returnTo: '/' }));
    expect(html.match(SVG_PATTERN)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true"');
    expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('<button'));
  });
});

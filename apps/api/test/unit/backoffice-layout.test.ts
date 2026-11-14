import { HttpStatus, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BackofficeNotice } from '../../src/backoffice/backoffice-notice';
import { ShellTheme, resolveTheme } from '../../src/web-shell/shell-theme';
import { ErrorPage } from '../../src/backoffice/views/error-page';
import { Layout, type LayoutProps } from '../../src/backoffice/layout';
import { SignInPage } from '../../src/backoffice/views/sign-in';
import { SignInCodePage } from '../../src/backoffice/views/sign-in-code';
import { DeployEnvironment } from '../../src/contract/deploy-environment';

const STYLESHEET_HREF = '/assets/backoffice.css?v=abc123';
const CSRF_TOKEN = 'csrf-token-value';
const LIVE_DOT_PATTERN = /class="live-dot"/g;
const BADGE_WITH_LIVE_DOT_PATTERN = /<span class="environment-badge"><span class="live-dot" aria-hidden="true"><\/span>/;
const HEADER_END_PATTERN = /<div class="header-end"><form method="post" action="\/sign-out"/;
const HEADER_PATTERN = /<header[\s\S]*?<\/header>/;
const FOOTER_PATTERN = /<footer[\s\S]*<\/footer>/;

function render(input: Partial<LayoutProps>): string {
  const props: LayoutProps = {
    locale: OwnerLocale.EnglishUs,
    environment: DeployEnvironment.Production,
    title: 'Overview',
    stylesheetHref: STYLESHEET_HREF,
    csrfToken: CSRF_TOKEN,
    signedIn: true,
    currentPath: '/numbers',
    returnPath: '/numbers/abc',
    notice: null,
    theme: ShellTheme.System,
    ...input,
  };
  return String(Layout({ ...props, children: 'PAGE_BODY' }));
}

describe('backoffice layout', () => {
  it('sets the document language from the locale', () => {
    expect(render({ locale: OwnerLocale.PortugueseBrazil })).toContain('lang="pt-BR"');
    expect(render({ locale: OwnerLocale.EnglishUs })).toContain('lang="en"');
  });

  it.each(Object.values(ShellTheme))('writes data-theme="%s" on the html element', (theme) => {
    expect(render({ theme })).toContain(`<html lang="en" dir="ltr" data-theme="${theme}">`);
  });

  it('writes only an enum member in data-theme for a hostile cookie value', () => {
    const hostileCookieValue = '"><script>alert(1)</script>';
    const html = render({ theme: resolveTheme({ cookieValue: hostileCookieValue }) });
    expect(html).toContain('<html lang="en" dir="ltr" data-theme="system">');
    expect(html).not.toContain('alert(1)');
  });

  it('returns the footer switchers to the return path while the navigation follows the current path', () => {
    const html = render({});
    expect(FOOTER_PATTERN.exec(html)![0].split('name="returnTo" value="/numbers/abc"')).toHaveLength(3);
    expect(html).toContain('href="/numbers" aria-current="page"');
  });

  it('shows both switchers in the footer on a signed-in page and on the sign-in page', () => {
    [render({}), render({ signedIn: false })].forEach((html) => {
      const footer = FOOTER_PATTERN.exec(html)![0];
      expect(footer).toContain('class="lang-menu"');
      expect(footer).toContain('class="switch"');
    });
  });

  it('keeps the switchers out of the header', () => {
    expect(HEADER_PATTERN.exec(render({}))![0]).not.toMatch(/lang-menu|class="switch"/);
  });

  it('shows no switcher on a page without a csrf token', () => {
    const html = render({ csrfToken: null, signedIn: false });
    expect(html).not.toContain('lang-menu');
    expect(html).not.toContain('class="switch"');
  });

  it('writes the theme on the error page', () => {
    const html = String(
      ErrorPage({ status: HttpStatus.NotFound, locale: OwnerLocale.EnglishUs, environment: null, theme: ShellTheme.Dark }),
    );
    expect(html).toContain('data-theme="dark"');
  });

  it('links the versioned stylesheet and titles the page', () => {
    const html = render({});
    expect(html).toContain(`<link rel="stylesheet" href="${STYLESHEET_HREF}"`);
    expect(html).toContain('<title>Overview · zapbip backoffice</title>');
  });

  it('links the favicon as the page icon', () => {
    expect(render({})).toContain('<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"');
  });

  it('puts the skip link first and targets the main content', () => {
    const html = render({});
    expect(html.indexOf('<a')).toBe(html.indexOf('<a href="#content"'));
    expect(html).toContain('Skip to content');
    expect(html).toContain('<main id="content">');
    expect(html).toContain('PAGE_BODY');
  });

  it('shows the navigation with the current page marked when signed in', () => {
    const html = render({});
    expect(html).toContain('href="/numbers" aria-current="page"');
    expect(html).toContain('href="/metrics"');
    expect(html).toContain('action="/sign-out"');
  });

  it('hides the navigation and sign-out when signed out', () => {
    const html = render({ signedIn: false });
    expect(HEADER_PATTERN.exec(html)![0]).not.toContain('<nav');
    expect(html).not.toContain('/sign-out');
  });

  it('carries the csrf token in the language and sign-out forms', () => {
    const html = render({});
    expect(html.split(`name="csrf" value="${CSRF_TOKEN}"`).length - 1).toBe(3);
    expect(html).toContain('action="/locale"');
    expect(html).toContain('action="/theme"');
  });

  it('renders no forms without a csrf token', () => {
    expect(render({ csrfToken: null, signedIn: false })).not.toContain('<form');
  });

  it('marks staging and development with a text badge and production with none', () => {
    expect(render({ environment: DeployEnvironment.Staging })).toContain('STAGING');
    expect(render({ environment: DeployEnvironment.Development })).toContain('DEVELOPMENT');
    expect(render({ environment: DeployEnvironment.Production })).not.toMatch(/STAGING|DEVELOPMENT/);
  });

  it('renders an allow-listed notice as a status with its words', () => {
    const html = render({ notice: BackofficeNotice.SessionEnded });
    expect(html).toContain('role="status"');
    expect(html).toContain('Your session ended. Sign in again.');
  });

  it('marks the signed-out shell on the body and the signed-in one with no class', () => {
    expect(render({ signedIn: false })).toContain('<body class="shell-signed-out">');
    expect(render({ signedIn: true })).toContain('<body>');
  });

  it('wraps sign-out in the header end', () => {
    expect(render({})).toMatch(HEADER_END_PATTERN);
  });

  it('keeps the header end out of a page without a csrf token', () => {
    expect(render({ csrfToken: null, signedIn: false })).not.toContain('header-end');
  });

  it.each([DeployEnvironment.Staging, DeployEnvironment.Development])('shows one live dot inside the %s badge', (environment) => {
    const html = render({ environment });
    expect(html).toMatch(BADGE_WITH_LIVE_DOT_PATTERN);
    expect(html.match(LIVE_DOT_PATTERN)).toHaveLength(1);
  });

  it('shows no live dot on production', () => {
    expect(render({ environment: DeployEnvironment.Production })).not.toContain('live-dot');
  });
});

describe('sign-in page', () => {
  it.each([
    [OwnerLocale.EnglishUs, 'Operator access', 'Your email and password first, then the code from your authenticator app.'],
    [OwnerLocale.PortugueseBrazil, 'Acesso do operador', 'Seu e-mail e sua senha. Depois, o código do seu autenticador.'],
  ])('renders the eyebrow and the lead in %s', (locale, eyebrow, lead) => {
    const html = String(
      SignInPage({
        locale,
        environment: DeployEnvironment.Production,
        theme: ShellTheme.System,
        csrfToken: CSRF_TOKEN,
        stylesheetHref: STYLESHEET_HREF,
        notice: null,
      }),
    );
    expect(html).toContain(eyebrow);
    expect(html).toContain(lead);
  });
});

describe('sign-in code page', () => {
  it.each([
    [OwnerLocale.EnglishUs, 'Enter the 6-digit code from your authenticator app. This step expires in 5 minutes.'],
    [OwnerLocale.PortugueseBrazil, 'Digite o código de 6 dígitos do seu app autenticador. Esta etapa expira em 5 minutos.'],
  ])('renders the code lead in %s and no password field', (locale, lead) => {
    const html = String(
      SignInCodePage({
        locale,
        environment: DeployEnvironment.Production,
        theme: ShellTheme.System,
        csrfToken: CSRF_TOKEN,
        stylesheetHref: STYLESHEET_HREF,
        notice: null,
      }),
    );
    expect(html).toContain(lead);
    expect(html).not.toContain('name="password"');
  });
});

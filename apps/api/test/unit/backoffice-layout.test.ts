import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BackofficeNotice } from '../../src/backoffice/backoffice-notice';
import { Layout, type LayoutProps } from '../../src/backoffice/layout';
import { SignInPage } from '../../src/backoffice/views/sign-in';
import { DeployEnvironment } from '../../src/contract/deploy-environment';

const STYLESHEET_HREF = '/assets/backoffice.css?v=abc123';
const CSRF_TOKEN = 'csrf-token-value';
const LIVE_DOT_PATTERN = /class="live-dot"/g;
const BADGE_WITH_LIVE_DOT_PATTERN = /<span class="environment-badge"><span class="live-dot" aria-hidden="true"><\/span>/;
const HEADER_END_PATTERN = /<div class="header-end">(?=[\s\S]*class="locale-switch")(?=[\s\S]*action="\/sign-out")/;

function render(input: Partial<LayoutProps>): string {
  const props: LayoutProps = {
    locale: OwnerLocale.EnglishUs,
    environment: DeployEnvironment.Production,
    title: 'Overview',
    stylesheetHref: STYLESHEET_HREF,
    csrfToken: CSRF_TOKEN,
    signedIn: true,
    currentPath: '/numbers',
    notice: null,
    ...input,
  };
  return String(Layout({ ...props, children: 'PAGE_BODY' }));
}

describe('backoffice layout', () => {
  it('sets the document language from the locale', () => {
    expect(render({ locale: OwnerLocale.PortugueseBrazil })).toContain('lang="pt-BR"');
    expect(render({ locale: OwnerLocale.EnglishUs })).toContain('lang="en"');
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
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('/sign-out');
  });

  it('carries the csrf token in the language and sign-out forms', () => {
    const html = render({});
    expect(html.split(`name="csrf" value="${CSRF_TOKEN}"`).length - 1).toBe(2);
    expect(html).toContain('action="/locale"');
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

  it('wraps the language switch and sign-out in the header end', () => {
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
    [OwnerLocale.EnglishUs, 'Operator access', 'Your backoffice key and a fresh code.'],
    [OwnerLocale.PortugueseBrazil, 'Acesso do operador', 'Sua chave do backoffice e um código novo.'],
  ])('renders the eyebrow and the lead in %s', (locale, eyebrow, lead) => {
    const html = String(
      SignInPage({
        locale,
        environment: DeployEnvironment.Production,
        csrfToken: CSRF_TOKEN,
        stylesheetHref: STYLESHEET_HREF,
        notice: null,
      }),
    );
    expect(html).toContain(eyebrow);
    expect(html).toContain(lead);
  });
});

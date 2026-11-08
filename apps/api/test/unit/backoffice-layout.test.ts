import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BackofficeNotice } from '../../src/backoffice/backoffice-notice';
import { Layout, type LayoutProps } from '../../src/backoffice/layout';
import { DeployEnvironment } from '../../src/contract/deploy-environment';

const STYLESHEET_HREF = '/assets/backoffice.css?v=abc123';
const CSRF_TOKEN = 'csrf-token-value';

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
});

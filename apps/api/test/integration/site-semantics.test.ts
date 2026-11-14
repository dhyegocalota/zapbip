import { reset } from 'cloudflare:test';
import { WebLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { applyLandingWaitlistMigration } from '../support/seed';
import { escapedHtml, joinForm, siteEnvironment, siteFetch } from '../support/site';

const PAGES = ['/', '/pt-br', '/terms', '/pt-br/privacidade', '/nowhere'] as const;
const LOCALES = [
  ['/', WebLocale.EnglishUs],
  ['/pt-br', WebLocale.PortugueseBrazil],
] as const;
const IMAGE_PATTERN = /<img\b[^>]*>/g;
const BUTTON_PATTERN = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
const INPUT_PATTERN = /<input\b[^>]*>/g;
const TAG_PATTERN = /<[^>]*>/g;

async function htmlOf(input: { path: string }): Promise<string> {
  return (await siteFetch(input)).text();
}

function copy(input: { key: SiteCopyKey; locale: WebLocale }): string {
  return escapedHtml({ text: renderSiteCopy(input) });
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('landmarks and headings', () => {
  it.each(PAGES)('%s has one banner, one main, one footer and one h1', async (path) => {
    const html = await htmlOf({ path });
    expect(html.match(/<header\b/g)).toHaveLength(1);
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html.match(/<footer\b/g)).toHaveLength(1);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it.each(PAGES)('%s names every navigation landmark', async (path) => {
    const html = await htmlOf({ path });
    const navigations = html.match(/<nav\b[^>]*>/g)!;
    expect(navigations.length).toBeGreaterThan(0);
    navigations.forEach((navigation) => expect(navigation).toMatch(/aria-label="[^"]+"/));
  });

  it.each(PAGES)('%s declares its language on the document and on every language option', async (path) => {
    const html = await htmlOf({ path });
    expect(html).toMatch(/<html lang="(en|pt-BR)"/);
    const options = html.match(/<button\b[^>]*class="lang-option"[^>]*>/g)!;
    expect(options.length).toBe(Object.values(WebLocale).length);
    options.forEach((option) => expect(option).toMatch(/lang="[a-zA-Z-]+"/));
  });
});

describe('information is never carried by an image alone', () => {
  it.each(PAGES)('%s gives every image an alt attribute', async (path) => {
    const images = (await htmlOf({ path })).match(IMAGE_PATTERN);
    (images === null ? [] : images).forEach((image) => expect(image).toMatch(/\balt="/));
  });

  it.each(PAGES)('%s gives every button a name', async (path) => {
    const html = await htmlOf({ path });
    [...html.matchAll(BUTTON_PATTERN)].forEach(([, attributes, content]) => {
      const hasText = content!.replace(TAG_PATTERN, '').trim().length > 0;
      const hasLabel = /aria-label="[^"]+"/.test(attributes!);
      expect(hasText || hasLabel).toBe(true);
    });
  });
});

describe('the join form', () => {
  it.each(LOCALES)('%s labels the email field, names the form and suggests the email autofill', async (path, locale) => {
    const html = await htmlOf({ path });
    expect(html).toContain(`<label class="visually-hidden" for="join-email">${copy({ key: SiteCopyKey.JoinEmailLabel, locale })}</label>`);
    expect(html).toContain(
      `<form class="join-form" method="post" action="/join" aria-label="${copy({ key: SiteCopyKey.JoinSubmit, locale })}">`,
    );
    expect(html).toMatch(/<input id="join-email" name="email" type="email"[^>]*autocomplete="email"/);
  });

  it.each(PAGES)('%s labels every visible input', async (path) => {
    const html = await htmlOf({ path });
    const visibleInputs = (html.match(INPUT_PATTERN) === null ? [] : html.match(INPUT_PATTERN)!).filter(
      (input) => !input.includes('type="hidden"'),
    );
    visibleInputs.forEach((input) => {
      const identifier = /\bid="([^"]+)"/.exec(input);
      const isLabelled = identifier !== null && html.includes(`for="${identifier[1]}"`);
      expect(isLabelled || /aria-label="[^"]+"/.test(input)).toBe(true);
    });
  });

  it('ties an invalid email to its error message', async () => {
    const response = await siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: 'nope' }) });
    const html = await response.text();
    expect(html).toMatch(/<input id="join-email"[^>]*aria-invalid="true"[^>]*aria-describedby="join-email-error"/);
    expect(html).toContain('<p class="field-error" id="join-email-error">');
  });

  it('ties a refused attempt to the notice that explains it', async () => {
    const env = siteEnvironment({ overrides: { INSTALL_PAGE_LIMITER: createFakeRateLimiter({ limit: 0 }) } });
    const response = await siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: 'maria@example.com' }), env });
    const html = await response.text();
    expect(response.status).toBe(429);
    expect(html).toMatch(/<div class="notice notice-warning" role="alert" id="join-notice">/);
    expect(html).toMatch(/<input id="join-email"[^>]*aria-describedby="join-notice"/);
  });
});

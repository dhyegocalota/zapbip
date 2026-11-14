import { OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { beforeAll, describe, expect, it } from 'vitest';
import { clientAppFetch } from '../support/client-app';
import { siteFetch } from '../support/site';
import { seedStartNumber } from '../support/start-link-numbers';
import { requestBackoffice, resetBackoffice } from './backoffice-auth-fixtures';

const MENU_PATTERN = /<details class="lang-menu">[\s\S]*?<\/details>/;
const THEME_PATTERN = /<form[^>]*class="switch"[^>]*>[\s\S]*?<\/form>/;
const FOOTER_PATTERN = /<footer[\s\S]*?<\/footer>/;
const FORM_OPENING_PATTERN = /<form[^>]*>/;
const INPUT_PATTERN = /<input[^>]*>/g;
const LOCALE_BUTTON_PATTERN = /<button[^>]*name="locale"[^>]*value="([^"]+)"/g;
const THEME_BUTTON_PATTERN = /<button[^>]*name="theme"[^>]*value="([^"]+)"/g;
const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")/;
const START_NUMBER = '+5511977770002';
const NUMBER_CREATED_AT = 1_700_000_000_000;

type Surface = { name: string; html: () => Promise<string> };

async function appHtml(): Promise<string> {
  return (await clientAppFetch({ path: '/' })).text();
}

const SURFACES: Surface[] = [
  { name: 'site', html: async () => (await siteFetch({ path: '/' })).text() },
  { name: 'client app', html: appHtml },
  { name: 'backoffice', html: async () => (await requestBackoffice({ path: '/sign-in', headers: { 'accept-language': 'en' } })).text() },
];

function normalized(input: { markup: string }): string {
  return input.markup.replace(FORM_OPENING_PATTERN, '<form>').replace(INPUT_PATTERN, '');
}

beforeAll(async () => {
  await resetBackoffice();
  await seedStartNumber({
    numberId: 'num_shell',
    displayNumber: START_NUMBER,
    state: WhatsAppNumberState.Active,
    createdAt: NUMBER_CREATED_AT,
  });
});

describe.each(SURFACES)('the shared shell on the $name', ({ html }) => {
  it('lists every locale of the enum in the footer language menu, each with a flag', async () => {
    const footer = FOOTER_PATTERN.exec(await html())![0];
    const menu = MENU_PATTERN.exec(footer)![0];
    const values = [...menu.matchAll(LOCALE_BUTTON_PATTERN)].map((match) => match[1]);
    expect([...values].sort()).toEqual(Object.values(OwnerLocale).sort());
    expect(menu.match(/<svg class="flag"/g)).toHaveLength(Object.values(OwnerLocale).length + 1);
  });

  it('offers the three themes in the footer as pressed-state buttons with icons', async () => {
    const footer = FOOTER_PATTERN.exec(await html())![0];
    const switchMarkup = THEME_PATTERN.exec(footer)![0];
    expect([...switchMarkup.matchAll(THEME_BUTTON_PATTERN)].map((match) => match[1])).toEqual(['light', 'dark', 'system']);
    expect(switchMarkup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(switchMarkup.match(/<svg class="theme-icon"/g)).toHaveLength(3);
  });

  it('names the language list form after the language label', async () => {
    const menu = MENU_PATTERN.exec(await html())![0];
    expect(menu).toMatch(/<form class="lang-list" method="post" action="[^"]+" aria-label="Language">/);
  });

  it('keeps every header link except the brand inside a named navigation', async () => {
    const header = /<header[\s\S]*?<\/header>/.exec(await html())![0];
    const outsideNavigation = header.replace(/<nav [^>]*aria-label="[^"]+"[^>]*>[\s\S]*?<\/nav>/g, '');
    const strayLinks = [...outsideNavigation.matchAll(/<a [^>]*>/g)].filter((link) => !link[0].includes('class="brand"'));
    expect(strayLinks).toEqual([]);
  });

  it('has the header, main and footer landmarks and a language on the document', async () => {
    const page = await html();
    expect(page).toMatch(/<html lang="en"/);
    expect(page).toContain('<header');
    expect(page).toContain('<main');
    expect(page).toContain('<footer');
  });

  it('carries no style attribute and no inline script', async () => {
    const page = await html();
    expect(page).not.toContain(' style=');
    expect(page).not.toMatch(INLINE_SCRIPT_PATTERN);
  });
});

const STYLESHEET_PATHS = [
  { name: 'site', fetch: () => siteFetch({ path: '/site/site.css' }) },
  { name: 'client app', fetch: () => clientAppFetch({ path: '/app.css' }) },
  { name: 'backoffice', fetch: () => requestBackoffice({ path: '/assets/backoffice.css' }) },
];

describe.each(STYLESHEET_PATHS)('the stylesheet of the $name', ({ fetch }) => {
  it('carries the shared menu, switch and compact footer rules', async () => {
    const css = await (await fetch()).text();
    expect(css).toContain('.lang-menu {');
    expect(css).toContain(".switch button[aria-pressed='true'] {");
    expect(css).toContain('.shell-footer {');
  });
});

describe('the site header', () => {
  it('holds the documentation link in a navigation named Main', async () => {
    const header = /<header[\s\S]*?<\/header>/.exec(await siteFetch({ path: '/' }).then((response) => response.text()))![0];
    expect(header).toMatch(
      /<nav class="header-end" aria-label="Main">[\s\S]*<a class="nav-link" href="https:\/\/docs\.zapbip\.com">Docs<\/a>/,
    );
  });
});

describe('the three surfaces', () => {
  it('draw the same language menu and the same theme switch', async () => {
    const pages = await Promise.all(SURFACES.map((surface) => surface.html()));
    const menus = pages.map((page) => normalized({ markup: MENU_PATTERN.exec(page)![0] }));
    const switches = pages.map((page) => normalized({ markup: THEME_PATTERN.exec(page)![0] }));
    expect(new Set(menus).size).toBe(1);
    expect(new Set(switches).size).toBe(1);
  });
});

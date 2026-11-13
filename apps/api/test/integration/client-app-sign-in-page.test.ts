import { reset } from 'cloudflare:test';
import { CLIENT_APP_LOGIN_TEXT, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clientAppFetch, prepareClientAppDatabase } from '../support/client-app';
import { seedStartNumber } from '../support/start-link-numbers';

const NUMBER_DIGITS = '5511977770003';
const NUMBER_CREATED_AT = 1_700_000_000_000;
const PAGES = [
  { path: '/', locale: OwnerLocale.EnglishUs, language: 'en', agentsLine: 'Agents: use the MCP tools', trust: 'Official WhatsApp API' },
  {
    path: '/pt-br',
    locale: OwnerLocale.PortugueseBrazil,
    language: 'pt-BR',
    agentsLine: 'Agentes: use as ferramentas MCP',
    trust: 'API oficial do WhatsApp',
  },
];

beforeEach(async () => {
  await prepareClientAppDatabase();
  await seedStartNumber({
    numberId: 'num_sign_in_page',
    displayNumber: `+${NUMBER_DIGITS}`,
    state: WhatsAppNumberState.Active,
    createdAt: NUMBER_CREATED_AT,
  });
});
afterEach(reset);

describe.each(PAGES)('the signed-out page at $path', ({ path, locale, language, agentsLine, trust }) => {
  async function html(): Promise<string> {
    return (await clientAppFetch({ path })).text();
  }

  it('is one labelled hero with a single primary sign-in link to WhatsApp', async () => {
    const page = await html();
    expect(page).toContain(`<html lang="${language}"`);
    expect(page.match(/<h1/g)).toHaveLength(1);
    const primary = [...page.matchAll(/<a[^>]*class="button button-primary[^"]*"[^>]*>/g)];
    expect(primary).toHaveLength(1);
    expect(primary[0]![0]).toContain(`https://wa.me/${NUMBER_DIGITS}?text=${CLIENT_APP_LOGIN_TEXT[locale]}`);
  });

  it('draws the login exchange as a labelled phone mock with the word the owner sends and the one-time link', async () => {
    const page = await html();
    const mock = /<figure class="phone"[\s\S]*?<\/figure>/.exec(page)![0];
    expect(mock).toMatch(/aria-label="[^"]+"/);
    expect(mock).toContain(`>${CLIENT_APP_LOGIN_TEXT[locale]}<`);
    expect(mock).toContain('class="bubble bubble-outgoing"');
    expect(mock).toContain('class="bubble bubble-incoming"');
    expect(mock).not.toMatch(/<img/);
  });

  it('points agents at the MCP tools in the docs and states the trust line', async () => {
    const page = await html();
    expect(page).toContain(agentsLine);
    expect(page).toMatch(/<a href="https:\/\/docs\.zapbip\.com[^"]*"/);
    expect(page).toContain(trust);
  });

  it('keeps the strict policy: no inline style, no script, no image request', async () => {
    const page = await html();
    expect(page).not.toContain(' style=');
    expect(page).not.toContain('<script');
    expect(page).not.toMatch(/<img|<link[^>]*rel="preload"/);
    expect(page.match(/<link[^>]*rel="stylesheet"/g)).toHaveLength(1);
  });
});

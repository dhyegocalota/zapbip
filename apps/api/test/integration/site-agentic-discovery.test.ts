import { reset } from 'cloudflare:test';
import { COMPANY, PRICING_FREE_MESSAGES, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { siteAgents, siteQuickStartOf } from '../../src/site/site-agents';
import { SECURITY_TEXT_VALIDITY_MS, SITE_EXAMPLE_CONNECTION_LINK } from '../../src/site/site-constants';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';
import { applyLandingWaitlistMigration } from '../support/seed';
import { SITE_ORIGIN, siteEnvironment, siteFetch } from '../support/site';

const JSON_TYPE = 'application/json; charset=utf-8';
const DOCS_ORIGIN = 'https://docs.zapbip.com';
const ENVIRONMENT = siteEnvironment({});
const SKILL_IDENTIFIERS = ['request_access', 'get_pricing', 'get_quick_start', 'setup_zapbip', 'read_docs'];

async function jsonOf(input: { path: string }): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await siteFetch(input);
  return { response, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('the MCP discovery documents', () => {
  it.each(['/.well-known/mcp.json', '/.well-known/mcp/server-card.json'])('%s points at the MCP server and the docs', async (path) => {
    const { response, body } = await jsonOf({ path });
    const urls = JSON.stringify(body);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(JSON_TYPE);
    expect(urls).toContain(ENVIRONMENT.PUBLIC_ORIGIN);
    expect(urls).toContain(`${DOCS_ORIGIN}/mcp`);
  });
});

describe('the agent card', () => {
  it('describes the public skills and where they live', async () => {
    const { response, body } = await jsonOf({ path: '/.well-known/agent-card.json' });
    const skills = body.skills as { id: string; name: string; description: string }[];
    expect(response.status).toBe(200);
    expect(body.name).toBe('zapbip');
    expect(body.url).toBe(SITE_ORIGIN);
    expect(body.documentationUrl).toBe(DOCS_ORIGIN);
    expect(skills.map((skill) => skill.id)).toEqual(SKILL_IDENTIFIERS);
    skills.forEach((skill) => expect(skill.description.length).toBeGreaterThan(0));
  });
});

describe('security.txt', () => {
  it('has a contact, an expiry 180 days out, a language list and the canonical address, and no policy while the repository is private', async () => {
    const before = Date.now();
    const response = await siteFetch({ path: '/.well-known/security.txt' });
    const text = await response.text();
    const expires = new Date(/^Expires: (.+)$/m.exec(text)![1]!).getTime();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(text).toContain(`Contact: mailto:${COMPANY.contactEmail}`);
    expect(text).not.toContain('Policy:');
    expect(text).toContain('Preferred-Languages: de, en, es, fr, ja, ko, pt, zh');
    expect(text).toContain(`Canonical: ${SITE_ORIGIN}/.well-known/security.txt`);
    expect(expires).toBeGreaterThanOrEqual(before + SECURITY_TEXT_VALIDITY_MS - 1000);
    expect(expires).toBeLessThanOrEqual(Date.now() + SECURITY_TEXT_VALIDITY_MS + 1000);
  });
});

describe('GET /api/pricing', () => {
  it('answers the plans in the language asked, in its currency', async () => {
    const { response, body } = await jsonOf({ path: '/api/pricing?language=pt-BR' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(JSON_TYPE);
    expect(body.language).toBe('pt-BR');
    expect(body.currency).toBe('BRL');
    expect((body.free as { messages: number }).messages).toBe(PRICING_FREE_MESSAGES);
    expect(JSON.stringify(body)).toContain(renderSiteCopy({ key: SiteCopyKey.PricingBilling, locale: OwnerLocale.PortugueseBrazil }));
  });

  it('answers English and dollars with no language asked', async () => {
    const { body } = await jsonOf({ path: '/api/pricing' });
    expect(body.language).toBe('en');
    expect(body.currency).toBe('USD');
  });

  it('refuses a language it does not serve', async () => {
    const { response, body } = await jsonOf({ path: '/api/pricing?language=xx' });
    expect(response.status).toBe(422);
    expect(body.status).toBe('unsupported_language');
  });
});

describe('GET /api/quick-start', () => {
  it.each(siteAgents().map((agent) => agent.id))('answers the hint and the code of %s', async (id) => {
    const { response, body } = await jsonOf({ path: `/api/quick-start?agent=${id}` });
    const expected = siteQuickStartOf({ id, locale: OwnerLocale.EnglishUs, connectionLink: SITE_EXAMPLE_CONNECTION_LINK });
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ agent: id, hint: expected.hint, path: expected.path, code: expected.code, isExample: true });
  });

  it('answers the any-MCP-app steps', async () => {
    const { body } = await jsonOf({ path: '/api/quick-start?agent=any&language=pt-BR' });
    expect(body.code).toBe(SITE_EXAMPLE_CONNECTION_LINK);
    expect(body.hint).toBe(renderSiteCopy({ key: SiteCopyKey.StartAnyHint, locale: OwnerLocale.PortugueseBrazil }));
  });

  it.each(['', '?agent=nope', '?agent=__proto__'])('lists the agents it knows for %j', async (query) => {
    const { response, body } = await jsonOf({ path: `/api/quick-start${query}` });
    expect(response.status).toBe(404);
    expect(body.status).toBe('unknown_agent');
    expect(body.agents).toEqual([...siteAgents().map((agent) => agent.id), 'any']);
  });
});

import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { OwnerLocale, TURNSTILE_ACTION_WAITLIST_JOIN } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import type { InstallClient } from '@zapbip/agents/install';
import { initialsOf, leadingAgentNames, SiteStartTab } from '../../src/site/site-agents';
import { startPathOf } from '../../src/site/site-links';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';
import { pricingValuesOf } from '../../src/site/price-format';
import { SITE_CONTENT_SECURITY_POLICY } from '../../src/site/site-policy';
import { copyHtml, escapedHtml, REFERRAL_CODE, SITE_ORIGIN, SITE_TURNSTILE_SITE_KEY, siteEnvironment, siteFetch } from '../support/site';

const ENGLISH_HEADERS = { 'Accept-Language': 'en-US,en;q=0.9' };
const PORTUGUESE_HEADERS = { 'Accept-Language': 'pt-BR,pt;q=0.9' };
const PORTUGUESE_PATH = '/pt-br';
const LOCALE_COOKIE = '__Host-zb_site_locale';
const THEME_COOKIE = '__Host-zb_site_theme';
const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\bsrc=)[^>]*>/;
const INLINE_STYLE_PATTERN = /<style|\sstyle="/;
const SEE_OTHER = 303;
const [FIRST_AGENT, SECOND_AGENT] = Object.entries(AGENT_INSTALLS).map(([id, install]) => ({ id, name: install.productName })) as [
  { id: string; name: string },
  { id: string; name: string },
];

function pathOfLocale(input: { path: string; headers: Record<string, string> | undefined }): string {
  return input.headers === PORTUGUESE_HEADERS ? `${PORTUGUESE_PATH}${input.path.replace(/^\//, '')}` : input.path;
}

async function pageOf(input: { path?: string; headers?: Record<string, string> }): Promise<string> {
  const { path = '/', headers } = input;
  const response = await siteFetch({
    path: pathOfLocale({ path, headers }),
    headers: headers === PORTUGUESE_HEADERS ? undefined : headers,
  });
  expect(response.status).toBe(200);
  return response.text();
}

describe('GET /', () => {
  it('renders the first fold in en_US', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    const copy = (key: SiteCopyKey): string => copyHtml({ key, locale: OwnerLocale.EnglishUs });
    expect(html).toContain('<html lang="en"');
    expect(html).toContain(copy(SiteCopyKey.HeroTitleLead));
    expect(html).toContain(copy(SiteCopyKey.HeroTitleAccent));
    expect(html).toContain(
      copyHtml({
        key: SiteCopyKey.HeroLead,
        locale: OwnerLocale.EnglishUs,
        values: { agents: leadingAgentNames() },
      }),
    );
    expect(html).toContain(copy(SiteCopyKey.JoinSubmit));
    expect(html).toContain('id="join-email"');
  });

  it('renders the first fold in pt_BR', async () => {
    const html = await pageOf({ headers: PORTUGUESE_HEADERS });
    const copy = (key: SiteCopyKey): string => copyHtml({ key, locale: OwnerLocale.PortugueseBrazil });
    expect(html).toContain('<html lang="pt-BR"');
    expect(html).toContain(copy(SiteCopyKey.HeroTitleLead));
    expect(html).toContain(copy(SiteCopyKey.JoinSubmit));
  });

  it('shows English at the root with no cookie and no Accept-Language', async () => {
    const html = await pageOf({});
    expect(html).toContain('<html lang="en"');
    expect(html).toContain(copyHtml({ key: SiteCopyKey.HeroTitleLead, locale: OwnerLocale.EnglishUs }));
  });

  it('the locale cookie wins over Accept-Language', async () => {
    const html = await pageOf({ headers: { ...PORTUGUESE_HEADERS, Cookie: `${LOCALE_COOKIE}=${OwnerLocale.EnglishUs}` } });
    expect(html).toContain('<html lang="en"');
  });

  it('carries a well-formed referral code into the form and shows the invited eyebrow', async () => {
    const html = await pageOf({ path: `/?ref=${REFERRAL_CODE}`, headers: ENGLISH_HEADERS });
    expect(html).toContain(`name="referralCode" value="${REFERRAL_CODE}"`);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.HeroInvited, locale: OwnerLocale.EnglishUs }));
  });

  it('drops a malformed referral code and shows the plain eyebrow', async () => {
    const html = await pageOf({ path: '/?ref=../../x', headers: ENGLISH_HEADERS });
    expect(html).not.toContain('name="referralCode"');
    expect(html).toContain(copyHtml({ key: SiteCopyKey.HeroEyebrow, locale: OwnerLocale.EnglishUs }));
  });

  it('renders the Turnstile widget with the site key and the join action', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).toContain('class="cf-turnstile"');
    expect(html).toContain(`data-sitekey="${SITE_TURNSTILE_SITE_KEY}"`);
    expect(html).toContain(`data-action="${TURNSTILE_ACTION_WAITLIST_JOIN}"`);
    expect(html).toContain('src="https://challenges.cloudflare.com/turnstile/v0/api.js"');
  });

  it.each([undefined, '', '   '])('replaces the form with the paused notice when the secret is %j', async (secret) => {
    const response = await siteFetch({
      path: '/',
      headers: ENGLISH_HEADERS,
      env: siteEnvironment({ overrides: { TURNSTILE_SECRET_KEY: secret } }),
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.JoinPausedTitle, locale: OwnerLocale.EnglishUs }));
    expect(html).not.toContain('id="join-email"');
    expect(html).not.toContain('cf-turnstile');
    expect(html).not.toContain('challenges.cloudflare.com');
  });

  it('shows the demo as a poster first with a lazy muted loop', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).toContain('class="demo-poster"');
    expect(html).toContain('fetchpriority="high"');
    expect(html).toMatch(/<video[^>]*\bmuted\b[^>]*\bloop\b[^>]*\bplaysinline\b[^>]*preload="none"/);
    expect(html).toContain('/site/demo-en_US-960.mp4');
    expect(html).toContain('/site/demo-en_US-960.webm');
    expect(html).toContain('/site/demo-en_US-poster-960.webp');
    expect(html).not.toContain('pt_BR-960');
  });

  it('has the sections of the design in order', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    const order = [
      'id="join"',
      'id="why"',
      'id="how"',
      'id="capabilities"',
      'id="start"',
      'id="pricing"',
      'id="privacy"',
      'id="faq"',
      'class="final',
    ];
    const positions = order.map((marker) => html.indexOf(marker));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((first, second) => first - second)).toEqual(positions);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it('puts the canonical, social and alternate links in the head', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/"`);
    expect(html).toContain(`<meta property="og:image" content="${SITE_ORIGIN}/site/og-en_US.png"`);
    expect(html).toContain(`<meta name="twitter:image" content="${SITE_ORIGIN}/site/og-en_US.png"`);
    expect(html).toContain('<meta property="og:image:width" content="1200"');
    expect(html).toContain('<meta property="og:image:height" content="630"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(html).toContain('hreflang="pt-BR"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain(`<title>${copyHtml({ key: SiteCopyKey.MetaTitle, locale: OwnerLocale.EnglishUs })} · zapbip</title>`);
    expect(html).toContain('rel="icon"');
  });

  it('puts the contact link only in the two places whose copy asks for it', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html.match(/mailto:/g)).toHaveLength(2);
  });

  it('keeps the page inside its policy: no inline script, no inline style', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).not.toMatch(INLINE_SCRIPT_PATTERN);
    expect(html).not.toMatch(INLINE_STYLE_PATTERN);
  });

  it('sends the site policy and no-store-free caching headers', async () => {
    const response = await siteFetch({ path: '/' });
    expect(response.headers.get('Content-Security-Policy')).toBe(SITE_CONTENT_SECURITY_POLICY);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Vary')).toContain('Accept-Language');
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('applies the theme cookie to the document', async () => {
    const html = await pageOf({ headers: { Cookie: `${THEME_COOKIE}=dark` } });
    expect(html).toContain('data-theme="dark"');
  });
});

describe('the Portuguese page', () => {
  it('chooses the Portuguese demo, poster, social image and widget language', async () => {
    const html = await pageOf({ headers: PORTUGUESE_HEADERS });
    expect(html).toContain('/site/demo-pt_BR-960.mp4');
    expect(html).toContain('/site/demo-pt_BR-960.webm');
    expect(html).toContain('/site/demo-pt_BR-poster-960.webp');
    expect(html).toContain('/site/demo-pt_BR-poster-540.webp');
    expect(html).toContain(`<meta property="og:image" content="${SITE_ORIGIN}/site/og-pt_BR.png"`);
    expect(html).toContain(`<meta name="twitter:image" content="${SITE_ORIGIN}/site/og-pt_BR.png"`);
    expect(html).toContain('data-language="pt-br"');
    expect(html).not.toContain('en_US-960');
  });

  it('writes the title, description, alt text and privacy note in Portuguese', async () => {
    const html = await pageOf({ headers: PORTUGUESE_HEADERS });
    const copy = (key: SiteCopyKey): string => copyHtml({ key, locale: OwnerLocale.PortugueseBrazil });
    expect(html).toContain(`<title>${copy(SiteCopyKey.MetaTitle)} · zapbip</title>`);
    expect(html).toContain(copy(SiteCopyKey.MetaOgImageAlt));
    expect(html).toContain(copy(SiteCopyKey.PrivacyNoteShort));
  });

  it('shows every error state in Portuguese', async () => {
    const response = await siteFetch({ path: '/nope', headers: PORTUGUESE_HEADERS });
    expect(await response.text()).toContain(copyHtml({ key: SiteCopyKey.NotFoundTitle, locale: OwnerLocale.PortugueseBrazil }));
  });
});

describe('the quick start', () => {
  const TAB_PATTERN = /<a class="start-tab" role="tab" id="start-tab-([^"]+)" href="([^"]+)" aria-selected="(true|false)"/g;
  const PANEL_MARKER = '<div class="start-panel" role="tabpanel"';
  const PANEL_HIDDEN_PATTERN = /^<div class="start-panel" role="tabpanel" id="start-panel-([^"]+)" aria-labelledby="[^"]+"( hidden="")?>/;
  const TAG_PATTERN = /<[^>]+>/g;
  const agents = Object.entries(AGENT_INSTALLS).map(([id, install]) => ({ id, name: install.productName, install }));
  const tabIds = [...agents.map((agent) => agent.id), SiteStartTab.AnyMcp];

  function startOf(input: { html: string }): string {
    return input.html.slice(input.html.indexOf('id="start"'), input.html.indexOf('id="pricing"'));
  }

  function panelsOf(input: { html: string }): { id: string; isHidden: boolean; html: string }[] {
    return startOf(input)
      .split(PANEL_MARKER)
      .slice(1)
      .map((chunk) => {
        const opening = PANEL_HIDDEN_PATTERN.exec(`${PANEL_MARKER}${chunk}`)!;
        return { id: opening[1]!, isHidden: opening[2] !== undefined, html: chunk };
      });
  }

  function selectedOf(input: { html: string }): string[] {
    return [...startOf(input).matchAll(TAB_PATTERN)].filter((match) => match[3] === 'true').map((match) => match[1]!);
  }

  function visibleIdsOf(input: { html: string }): string[] {
    return panelsOf(input)
      .filter((panel) => !panel.isHidden)
      .map((panel) => panel.id);
  }

  it.each([
    ['en_US', OwnerLocale.EnglishUs, ENGLISH_HEADERS],
    ['pt_BR', OwnerLocale.PortugueseBrazil, PORTUGUESE_HEADERS],
  ])(
    'has one tab per installable agent in registry order, then any app, linked with the language in %s',
    async (_name, locale, headers) => {
      const html = await pageOf({ headers });
      const tabs = [...startOf({ html }).matchAll(TAB_PATTERN)].map((match) => ({ id: match[1], href: match[2] }));
      expect(tabs.map((tab) => tab.id)).toEqual(tabIds);
      expect(tabs.map((tab) => tab.href)).toEqual(
        tabIds.map((id) => escapedHtml({ text: startPathOf({ tab: id as InstallClient | SiteStartTab, locale, referralCode: null }) })),
      );
      expect(startOf({ html })).toContain(`role="tablist" aria-label="${copyHtml({ key: SiteCopyKey.StartTablistLabel, locale })}"`);
    },
  );

  it('shows one panel per tab and only the first agent by default', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(panelsOf({ html }).map((panel) => panel.id)).toEqual(tabIds);
    expect(selectedOf({ html })).toEqual([agents[0]!.id]);
    expect(visibleIdsOf({ html })).toEqual([agents[0]!.id]);
  });

  it.each([
    ['an agent id', `/?agent=${agents[1]!.id}`, agents[1]!.id],
    ['the any tab', `/?agent=${SiteStartTab.AnyMcp}`, SiteStartTab.AnyMcp],
    ['an unknown id', '/?agent=nope', agents[0]!.id],
    ['a prototype name', '/?agent=__proto__', agents[0]!.id],
    ['a repeated parameter', `/?agent=${agents[2]!.id}&agent=${agents[1]!.id}`, agents[2]!.id],
    ['markup', `/?agent=${encodeURIComponent('<script>alert(1)</script>')}`, agents[0]!.id],
    ['ten thousand characters', `/?agent=${'x'.repeat(10_000)}`, agents[0]!.id],
  ])('selects the tab and the panel for %s', async (_name, path, expected) => {
    const html = await pageOf({ path, headers: ENGLISH_HEADERS });
    expect(selectedOf({ html })).toEqual([expected]);
    expect(visibleIdsOf({ html })).toEqual([expected]);
    expect(html).not.toContain('<script>alert');
  });

  it.each([
    ['en_US', OwnerLocale.EnglishUs, ENGLISH_HEADERS],
    ['pt_BR', OwnerLocale.PortugueseBrazil, PORTUGUESE_HEADERS],
  ])('shows the hint and the code the registry gives, with the placeholder link, in %s', async (_name, locale, headers) => {
    const html = await pageOf({ headers });
    const placeholder = renderSiteCopy({ key: SiteCopyKey.StartLinkPlaceholder, locale });
    const panels = panelsOf({ html });
    agents.forEach((agent) => {
      const quickStart = agent.install.quickStart({ locale, connectionLink: placeholder });
      const text = panels.find((panel) => panel.id === agent.id)!.html.replace(TAG_PATTERN, '');
      expect(text).toContain(escapedHtml({ text: quickStart.hint }));
      expect(text).toContain(escapedHtml({ text: quickStart.code }));
      expect(text).toContain(escapedHtml({ text: quickStart.hint }));
      const panel = panels.find((candidate) => candidate.id === agent.id)!.html;
      expect(panel.includes('class="code-path"')).toBe(quickStart.path.length > 0);
      quickStart.path.forEach((step) => expect(text).toContain(escapedHtml({ text: step })));
      expect(panel).toContain(`data-code="${escapedHtml({ text: quickStart.code })}"`);
      expect(panel.match(/class="code-line"/g)).toHaveLength(quickStart.code.split('\n').length);
    });
    const anyText = panels.find((panel) => panel.id === SiteStartTab.AnyMcp)!.html.replace(TAG_PATTERN, '');
    expect(anyText).toContain(copyHtml({ key: SiteCopyKey.StartAnyHint, locale }));
    expect(anyText).toContain(escapedHtml({ text: placeholder }));
    [SiteCopyKey.StartAnyStepOpen, SiteCopyKey.StartAnyStepAdd, SiteCopyKey.StartAnyStepPaste].forEach((key) =>
      expect(anyText).toContain(copyHtml({ key, locale })),
    );
  });

  it('shows the logo image where the install facet names an official logo and the initials badge where it does not', async () => {
    const html = startOf({ html: await pageOf({ headers: ENGLISH_HEADERS }) });
    const tabHtml = (id: string): string =>
      html.slice(html.indexOf(`id="start-tab-${id}"`), html.indexOf('</a>', html.indexOf(`id="start-tab-${id}"`)));
    agents.forEach((agent) => {
      const tab = tabHtml(agent.id);
      if (agent.install.officialLogo !== null) {
        expect(tab).toContain(`<img class="start-logo-image" src="/site/logos/${agent.install.officialLogo}.svg" alt=""`);
        expect(tab).not.toContain('agent-badge');
        return;
      }
      expect(tab).toContain(`<span class="agent-badge" aria-hidden="true">${initialsOf({ name: agent.name })}</span>`);
      expect(tab).not.toContain('<img');
    });
  });

  it('gives each panel a hidden copy button, one call to action and one short line beside it, and no steps row', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    const locale = OwnerLocale.EnglishUs;
    const panels = panelsOf({ html });
    panels.forEach((panel) => {
      expect(panel.html).toContain(`<p class="start-note">${copyHtml({ key: SiteCopyKey.StartNote, locale })}</p>`);
      expect(panel.html).not.toContain('start-steps');
      expect(panel.html.match(/class="start-copy" type="button" hidden=""/g)).toHaveLength(1);
      expect(panel.html.match(/class="button button-primary start-cta"/g)).toHaveLength(1);
    });
    expect(startOf({ html }).match(new RegExp(copyHtml({ key: SiteCopyKey.StartCta, locale }), 'g'))).toHaveLength(panels.length);
    const agentCta = escapedHtml({ text: `/?agent=${agents[0]!.id}#join` });
    expect(panels[0]!.html).toContain(`href="${agentCta}" data-picked-label="`);
    expect(panels.at(-1)!.html).toContain('href="/#join" data-clear-agent');
    expect(startOf({ html })).toContain('id="start-announcement"');
  });

  it('carries the referral code in every link', async () => {
    const html = startOf({ html: await pageOf({ path: `/?ref=${REFERRAL_CODE}`, headers: ENGLISH_HEADERS }) });
    const hrefs = [...html.matchAll(/<a class="(?:start-tab|button button-primary start-cta)"[^>]* href="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(hrefs.length).toBe(tabIds.length * 2);
    expect(hrefs.filter((href) => !href!.includes(`ref=${REFERRAL_CODE}`))).toEqual([]);
  });

  it('has none of the old tiles', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).not.toContain('agent-card');
    expect(html).not.toContain('agent-pick');
  });

  it('names the first two agents of the registry in the subhead', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).toContain(`${agents[0]!.name}, ${agents[1]!.name} and any MCP agent`);
  });
});

describe('the agent hint', () => {
  const HINT_PATTERN = /<p class="join-agent"([^>]*)>([^<]*)<\/p>/;

  async function hintOf(input: { path: string }): Promise<{ attributes: string; text: string }> {
    const match = HINT_PATTERN.exec(await pageOf({ path: input.path, headers: ENGLISH_HEADERS }));
    return { attributes: match![1]!, text: match![2]! };
  }

  it('shows the picked agent from the query', async () => {
    const hint = await hintOf({ path: `/?agent=${FIRST_AGENT.id}` });
    expect(hint.text).toBe(
      copyHtml({ key: SiteCopyKey.AgentCardPicked, locale: OwnerLocale.EnglishUs, values: { agent: FIRST_AGENT.name } }),
    );
    expect(hint.attributes).not.toContain('hidden');
  });

  it.each([
    ['an unknown id', 'nope'],
    ['a prototype name', '__proto__'],
    ['an empty value', ''],
    ['a script tag', '<script>alert(1)</script>'],
    ['a list of ids', `${FIRST_AGENT.id},${SECOND_AGENT.id}`],
    ['ten thousand characters', 'x'.repeat(10_000)],
  ])('ignores %s and keeps the hint empty and hidden', async (_name, value) => {
    const hint = await hintOf({ path: `/?agent=${encodeURIComponent(value)}` });
    expect(hint.text).toBe('');
    expect(hint.attributes).toContain('hidden');
  });

  it('takes the first value of a repeated parameter and never echoes markup', async () => {
    const html = await pageOf({ path: `/?agent=${SECOND_AGENT.id}&agent=<b>`, headers: ENGLISH_HEADERS });
    expect(html).toContain(
      copyHtml({ key: SiteCopyKey.AgentCardPicked, locale: OwnerLocale.EnglishUs, values: { agent: SECOND_AGENT.name } }),
    );
    expect(html).not.toContain('<b>');
  });

  it('carries the agent and the referral code together', async () => {
    const html = await pageOf({ path: `/?agent=${SECOND_AGENT.id}&ref=${REFERRAL_CODE}`, headers: ENGLISH_HEADERS });
    expect(html).toContain(`name="referralCode" value="${REFERRAL_CODE}"`);
    expect(html).toContain(
      copyHtml({ key: SiteCopyKey.AgentCardPicked, locale: OwnerLocale.EnglishUs, values: { agent: SECOND_AGENT.name } }),
    );
  });

  it('shows the hint in Portuguese', async () => {
    const html = await pageOf({ path: `/?agent=${SECOND_AGENT.id}`, headers: PORTUGUESE_HEADERS });
    expect(html).toContain(
      copyHtml({ key: SiteCopyKey.AgentCardPicked, locale: OwnerLocale.PortugueseBrazil, values: { agent: SECOND_AGENT.name } }),
    );
  });
});

describe('the differentiators', () => {
  const TITLE_KEYS = [
    SiteCopyKey.WhyOfficialTitle,
    SiteCopyKey.WhyAskTitle,
    SiteCopyKey.WhyRoutingTitle,
    SiteCopyKey.WhyWakeTitle,
    SiteCopyKey.WhyEveryAgentTitle,
    SiteCopyKey.WhyFastTitle,
  ];

  it.each([
    ['en_US', OwnerLocale.EnglishUs, ENGLISH_HEADERS],
    ['pt_BR', OwnerLocale.PortugueseBrazil, PORTUGUESE_HEADERS],
  ])('tells six stories in order, each with its own vignette, in %s', async (_name, locale, headers) => {
    const html = await pageOf({ headers });
    const section = html.slice(html.indexOf('id="why"'), html.indexOf('id="how"'));
    expect(section.match(/class="why-item[ "]/g)).toHaveLength(TITLE_KEYS.length);
    expect(section.match(/class="why-visual"/g)).toHaveLength(TITLE_KEYS.length);
    const positions = TITLE_KEYS.map((key) => section.indexOf(copyHtml({ key, locale })));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((first, second) => first - second)).toEqual(positions);
    expect(section).toContain(copyHtml({ key: SiteCopyKey.WhyTitle, locale }));
  });

  it('names the leading agents of the registry in the every-agent story', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html).toContain(
      copyHtml({ key: SiteCopyKey.WhyEveryAgentBody, locale: OwnerLocale.EnglishUs, values: { agents: leadingAgentNames() } }),
    );
  });

  it('keeps every vignette out of the accessibility tree', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    const section = html.slice(html.indexOf('id="why"'), html.indexOf('id="how"'));
    expect(section.match(/class="why-visual" aria-hidden="true"/g)).toHaveLength(TITLE_KEYS.length);
  });

  it('marks the sections for the staggered reveal', async () => {
    const html = await pageOf({ headers: ENGLISH_HEADERS });
    expect(html.match(/class="[^"]*\breveal\b/g)!.length).toBeGreaterThan(TITLE_KEYS.length);
  });
});

describe('the pricing', () => {
  function pricingOf(input: { html: string }): string {
    return input.html.slice(input.html.indexOf('id="pricing"'), input.html.indexOf('id="privacy"'));
  }

  it.each([
    ['en_US', OwnerLocale.EnglishUs, ENGLISH_HEADERS],
    ['pt_BR', OwnerLocale.PortugueseBrazil, PORTUGUESE_HEADERS],
  ])('highlights a free plan with its price and what it includes in %s', async (_name, locale, headers) => {
    const section = pricingOf({ html: await pageOf({ headers }) });
    const values = pricingValuesOf({ locale });
    const keys = [
      SiteCopyKey.PricingFreeName,
      SiteCopyKey.PricingFreeNote,
      SiteCopyKey.PricingFreePhone,
      SiteCopyKey.PricingFreeAgents,
      SiteCopyKey.PricingFreeAsk,
      SiteCopyKey.PricingFreeRouting,
      SiteCopyKey.PricingFreeWake,
      SiteCopyKey.PricingCta,
    ];
    expect(keys.filter((key) => !section.includes(copyHtml({ key, locale, values })))).toEqual([]);
    expect(section).toContain('class="card plan plan-free');
    expect(section).toContain(`aria-label="${copyHtml({ key: SiteCopyKey.PricingFreeIncludes, locale })}"`);
  });

  it('writes the prices in the currency of the page language', async () => {
    const english = pricingOf({ html: await pageOf({ headers: ENGLISH_HEADERS }) });
    const portuguese = pricingOf({ html: await pageOf({ headers: PORTUGUESE_HEADERS }) });
    expect(english).toContain('>$0<');
    expect(english).toContain('>$9<');
    expect(english).not.toContain('R$');
    expect(portuguese).toContain('>R$\u00a00<');
    expect(portuguese).toContain('>R$\u00a049<');
    expect(portuguese).not.toMatch(/>\$\d/);
  });

  it.each([
    ['en_US', OwnerLocale.EnglishUs, ENGLISH_HEADERS],
    ['pt_BR', OwnerLocale.PortugueseBrazil, PORTUGUESE_HEADERS],
  ])(
    'shows the Pro plan with its monthly price, the included messages and the price of each extra block in %s',
    async (_name, locale, headers) => {
      const section = pricingOf({ html: await pageOf({ headers }) });
      const pro = section.slice(section.indexOf('class="card plan plan-pro'));
      const values = pricingValuesOf({ locale });
      const keys = [
        SiteCopyKey.PricingProName,
        SiteCopyKey.PricingProPeriod,
        SiteCopyKey.PricingProIncluded,
        SiteCopyKey.PricingProOverage,
        SiteCopyKey.PricingBilling,
      ];
      expect(keys.filter((key) => !pro.includes(copyHtml({ key, locale, values })))).toEqual([]);
      expect(pro).toContain(`href="#join">${copyHtml({ key: SiteCopyKey.PricingProCta, locale })}</a>`);
      expect(section).toContain(copyHtml({ key: SiteCopyKey.PricingMessageDefinition, locale }));
    },
  );

  it('lets the Pro card sit at its own height, not the height of the Free card', async () => {
    const section = pricingOf({ html: await pageOf({ headers: ENGLISH_HEADERS }) });
    expect(section).toContain('class="card plan plan-pro');
  });

  it('sends the free button to the form', async () => {
    const section = pricingOf({ html: await pageOf({ headers: ENGLISH_HEADERS }) });
    expect(section).toMatch(/<a class="button button-primary[^"]*" href="#join">Get started free<\/a>/);
  });
});

describe('the free offer across the page', () => {
  it.each([
    ['en_US', OwnerLocale.EnglishUs, ENGLISH_HEADERS, 'Get started free'],
    ['pt_BR', OwnerLocale.PortugueseBrazil, PORTUGUESE_HEADERS, 'Comece grátis'],
  ])('labels the header, the hero and the final call in %s', async (_name, _locale, headers, label) => {
    const html = await pageOf({ headers });
    expect(html).toContain(`href="#join">${label}</a>`);
    expect(html).toMatch(new RegExp(`<span data-label[^>]*>${label}</span>`));
    expect(html.match(new RegExp(`>${label}<`, 'g'))!.length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    [ENGLISH_HEADERS, 'free'],
    [PORTUGUESE_HEADERS, 'grátis'],
  ])('mentions free in the meta description', async (headers, word) => {
    const html = await pageOf({ headers });
    const description = /<meta name="description" content="([^"]*)"/.exec(html)![1]!;
    expect(description.toLowerCase()).toContain(word);
  });

  it.each([OwnerLocale.EnglishUs, OwnerLocale.PortugueseBrazil])('answers "is it free" in the FAQ in %s', async (locale) => {
    const html = await pageOf({ headers: locale === OwnerLocale.EnglishUs ? ENGLISH_HEADERS : PORTUGUESE_HEADERS });
    expect(html).toContain(`<summary>${copyHtml({ key: SiteCopyKey.FaqFreeQuestion, locale })}</summary>`);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.FaqFreeAnswer, locale, values: pricingValuesOf({ locale }) }));
    expect(html).toContain(copyHtml({ key: SiteCopyKey.FaqPriceAnswer, locale, values: pricingValuesOf({ locale }) }));
  });

  it.each([OwnerLocale.EnglishUs, OwnerLocale.PortugueseBrazil])(
    'says in the FAQ that nobody brings their own number yet in %s',
    async (locale) => {
      const html = await pageOf({ headers: locale === OwnerLocale.EnglishUs ? ENGLISH_HEADERS : PORTUGUESE_HEADERS });
      expect(html).toContain(`<summary>${copyHtml({ key: SiteCopyKey.FaqOwnNumberQuestion, locale })}</summary>`);
      expect(html).toContain(copyHtml({ key: SiteCopyKey.FaqOwnNumberAnswer, locale }));
      expect(html).not.toMatch(/\{(free|price|included|overage|block)\}/);
    },
  );
});

describe('site assets', () => {
  it('serves the stylesheet linked from the page, cacheable for a year', async () => {
    const html = await pageOf({});
    const href = /<link rel="stylesheet" href="([^"]+)"/.exec(html)![1]!;
    const response = await siteFetch({ path: href });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/css');
    expect(response.headers.get('Cache-Control')).toContain('immutable');
  });

  it('serves the script linked from the page', async () => {
    const html = await pageOf({});
    const src = /<script src="([^"]+site\.js[^"]*)"/.exec(html)![1]!;
    const response = await siteFetch({ path: src });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/javascript');
  });
});

describe('canonical per locale', () => {
  it('gives the Portuguese page its own canonical URL', async () => {
    const html = await pageOf({ headers: PORTUGUESE_HEADERS });
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/pt-br"`);
    expect(html).toContain(`<meta property="og:url" content="${SITE_ORIGIN}/pt-br"`);
  });
});

describe('preferences and redirects', () => {
  it('POST /locale sets the cookie and returns to the page keeping the referral code', async () => {
    const response = await siteFetch({
      path: '/locale',
      method: 'POST',
      form: { locale: OwnerLocale.EnglishUs, returnTo: `/?ref=${REFERRAL_CODE}` },
    });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`/?ref=${REFERRAL_CODE}`);
    expect(response.headers.get('Set-Cookie')).toContain(`${LOCALE_COOKIE}=${OwnerLocale.EnglishUs}`);
  });

  it.each(['//evil.example', 'https://evil.example/', '/numbers', '/?ref=../../x'])(
    'POST /locale refuses the return target %s',
    async (returnTo) => {
      const response = await siteFetch({ path: '/locale', method: 'POST', form: { locale: OwnerLocale.EnglishUs, returnTo } });
      expect(response.headers.get('Location')).toBe('/');
    },
  );

  it('POST /locale ignores an unknown locale', async () => {
    const response = await siteFetch({ path: '/locale', method: 'POST', form: { locale: 'xx_XX', returnTo: '/' } });
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('POST /theme sets the cookie only for a known theme', async () => {
    const known = await siteFetch({ path: '/theme', method: 'POST', form: { theme: 'dark', returnTo: '/' } });
    expect(known.headers.get('Set-Cookie')).toContain(`${THEME_COOKIE}=dark`);
    const unknown = await siteFetch({ path: '/theme', method: 'POST', form: { theme: 'neon', returnTo: '/' } });
    expect(unknown.headers.get('Set-Cookie')).toBeNull();
  });

  it('GET /join answers 303 to the page, keeping a well-formed ref', async () => {
    const response = await siteFetch({ path: `/join?ref=${REFERRAL_CODE}` });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`/?ref=${REFERRAL_CODE}`);
  });

  it('answers a not-found page with noindex for an unknown path', async () => {
    const response = await siteFetch({ path: '/nope', headers: ENGLISH_HEADERS });
    const html = await response.text();
    expect(response.status).toBe(404);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.NotFoundTitle, locale: OwnerLocale.EnglishUs }));
    expect(html).toContain('<meta name="robots" content="noindex"');
  });
});

describe('the paused waitlist', () => {
  const PAUSED = siteEnvironment({ overrides: { TURNSTILE_SECRET_KEY: undefined } });

  async function pausedPage(): Promise<string> {
    const response = await siteFetch({ path: '/', headers: ENGLISH_HEADERS, env: PAUSED });
    expect(response.status).toBe(200);
    return response.text();
  }

  it('still tells the stories, shows the quick start and the pricing', async () => {
    const html = await pausedPage();
    expect(html.match(/class="why-item"/g)).toHaveLength(6);
    expect(html).toContain('id="start"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('id="pricing"');
    expect(html).toContain(copyHtml({ key: SiteCopyKey.PricingFreeName, locale: OwnerLocale.EnglishUs }));
    expect(html).not.toContain('id="join-email"');
  });

  it('keeps every call to action pointing at the join anchor', async () => {
    const html = await pausedPage();
    const hrefs = [...html.matchAll(/<a class="button button-primary start-cta" href="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((href) => !href!.endsWith('#join'))).toEqual([]);
    expect(html).toContain('id="join"');
  });
});

describe('the fifth story', () => {
  it.each([
    [ENGLISH_HEADERS, 'Works with the agents you use'],
    [PORTUGUESE_HEADERS, 'Funciona com os agentes que você usa'],
  ])('is titled after the agents the visitor already uses', async (headers, title) => {
    expect(await pageOf({ headers })).toContain(`<h3>${title}</h3>`);
  });
});

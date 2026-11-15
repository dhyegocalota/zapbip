import { reset } from 'cloudflare:test';
import { COMMAND_WORDS } from '@zapbip/core';
import { CommandKind, DOCS_LANGUAGE_OF_OWNER_LOCALE, INSTALL_SELF_TEST_TEXT, OwnerLocale, START_LINK } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupPathOf } from '../../src/site/agentic-paths';
import { siteAgents, siteQuickStartOf } from '../../src/site/site-agents';
import { CONNECTION_SECRET_PREFIX } from '../../src/contract/constants';
import { SETUP_CONNECTION_PLACEHOLDER } from '../../src/site/site-constants';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';
import { localePathOf } from '../../src/site/site-language';
import { applyLandingWaitlistMigration } from '../support/seed';
import { copyHtml, escapedHtml, SITE_ORIGIN, siteFetch } from '../support/site';

const MARKDOWN_TYPE = 'text/markdown; charset=utf-8';
const OK = 200;
const LOCALES = Object.values(OwnerLocale);
const SETUP_FILE = '/setup.md';
const PANEL_MARKER = '<div class="start-panel" role="tabpanel"';
const MANUAL_OPENING = '<details class="start-manual">';

function prefixOf(input: { locale: OwnerLocale }): string {
  const home = localePathOf({ locale: input.locale });
  return home === '/' ? '' : home;
}

function promptOf(input: { locale: OwnerLocale }): string {
  const { locale } = input;
  return renderSiteCopy({
    key: SiteCopyKey.StartPromptLine,
    locale,
    values: { setupUrl: `${SITE_ORIGIN}${prefixOf({ locale })}${SETUP_FILE}` },
  });
}

async function setupOf(input: { locale: OwnerLocale }): Promise<{ response: Response; text: string }> {
  const response = await siteFetch({ path: `${prefixOf(input)}${SETUP_FILE}` });
  return { response, text: await response.text() };
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('the setup page address', () => {
  it.each(LOCALES)('is the language path plus /setup.md in %s', (locale) => {
    expect(setupPathOf({ locale })).toBe(`${prefixOf({ locale })}${SETUP_FILE}`);
  });
});

describe('GET /setup.md in every language', () => {
  it.each(LOCALES)('answers Markdown headed by the title in %s', async (locale) => {
    const { response, text } = await setupOf({ locale });
    expect(response.status).toBe(OK);
    expect(response.headers.get('content-type')).toBe(MARKDOWN_TYPE);
    expect(text.startsWith(`# ${renderSiteCopy({ key: SiteCopyKey.SetupTitle, locale })}\n`)).toBe(true);
  });

  it.each(LOCALES)('walks the three steps and the safety rule in %s', async (locale) => {
    const { text } = await setupOf({ locale });
    [
      SiteCopyKey.SetupIntro,
      SiteCopyKey.SetupStepOneTitle,
      SiteCopyKey.SetupStepTwoTitle,
      SiteCopyKey.SetupStepThreeTitle,
      SiteCopyKey.SetupSafetyTitle,
      SiteCopyKey.SetupSafetyBody,
    ].forEach((key) => expect(text).toContain(renderSiteCopy({ key, locale })));
  });

  it.each(LOCALES)('names the start link and the create-agent words of the owner language in %s', async (locale) => {
    const { text } = await setupOf({ locale });
    const { words } = COMMAND_WORDS.find((entry) => entry.kind === CommandKind.CreateAgent && entry.locale === locale)!;
    const agentName = renderSiteCopy({ key: SiteCopyKey.SetupAgentName, locale });
    expect(text).toContain(`${START_LINK}?lang=${DOCS_LANGUAGE_OF_OWNER_LOCALE[locale]}`);
    expect(text).toContain(`\`${words} <${agentName}>\``);
  });

  it.each(LOCALES)('asks for the install self-test text of the owner language in %s', async (locale) => {
    const { text } = await setupOf({ locale });
    expect(text).toContain(INSTALL_SELF_TEST_TEXT[locale]);
  });

  it.each(LOCALES)('covers every agent of the registry with its code and the placeholder in %s', async (locale) => {
    const { text } = await setupOf({ locale });
    siteAgents().forEach((agent) => {
      const { code } = siteQuickStartOf({ id: agent.id, locale, connectionLink: SETUP_CONNECTION_PLACEHOLDER });
      expect(text).toContain(`### ${agent.name}`);
      expect(text).toContain(code);
    });
    expect(text).toContain(SETUP_CONNECTION_PLACEHOLDER);
  });

  it('never carries a connection secret, not even the example one', async () => {
    const results = await Promise.all(LOCALES.map((locale) => setupOf({ locale })));
    results.forEach(({ text }) => expect(text).not.toContain(CONNECTION_SECRET_PREFIX));
  });
});

describe('the quick start prompt', () => {
  it.each(LOCALES)('shows the one line first in every panel and the manual command in a collapsed disclosure in %s', async (locale) => {
    const response = await siteFetch({ path: localePathOf({ locale }) });
    const html = await response.text();
    const start = html.slice(html.indexOf('id="start"'), html.indexOf('id="pricing"'));
    const panels = start.split(PANEL_MARKER).slice(1);
    expect(panels).toHaveLength(siteAgents().length + 1);
    panels.forEach((panel) => {
      const manualStart = panel.indexOf(MANUAL_OPENING);
      expect(manualStart).toBeGreaterThan(-1);
      expect(panel.slice(0, manualStart)).toContain(escapedHtml({ text: promptOf({ locale }) }));
      expect(panel.slice(manualStart)).toContain(`<summary>${copyHtml({ key: SiteCopyKey.StartManualSummary, locale })}</summary>`);
      expect(panel).not.toContain('<details class="start-manual" open');
    });
  });

  it.each(LOCALES)('puts the copy button in the prompt window only in %s', async (locale) => {
    const html = await (await siteFetch({ path: localePathOf({ locale }) })).text();
    const start = html.slice(html.indexOf('id="start"'), html.indexOf('id="pricing"'));
    start
      .split(PANEL_MARKER)
      .slice(1)
      .forEach((panel) => {
        const manualStart = panel.indexOf(MANUAL_OPENING);
        expect(panel.slice(0, manualStart).match(/class="start-copy"/g)).toHaveLength(1);
        expect(panel.slice(manualStart)).not.toContain('class="start-copy"');
      });
  });
});

describe('the setup page is linked from every agent surface', () => {
  it.each(LOCALES)('llms.txt names it in %s', async (locale) => {
    const text = await (await siteFetch({ path: `${prefixOf({ locale })}/llms.txt` })).text();
    expect(text).toContain(`${SITE_ORIGIN}${setupPathOf({ locale })}`);
  });

  it.each(LOCALES)('the home twin carries the one line in %s', async (locale) => {
    const home = locale === OwnerLocale.EnglishUs ? '/index' : localePathOf({ locale });
    const text = await (await siteFetch({ path: `${home}.md` })).text();
    expect(text).toContain(promptOf({ locale }));
  });

  it('the agent card has a skill that points at the setup page', async () => {
    const card = (await (await siteFetch({ path: '/.well-known/agent-card.json' })).json()) as {
      skills: { id: string; description: string }[];
    };
    const skill = card.skills.find((candidate) => candidate.id === 'setup_zapbip')!;
    expect(skill.description).toContain(SETUP_FILE);
  });

  it.each([
    ['any', 'en', OwnerLocale.EnglishUs],
    ['any', 'pt-BR', OwnerLocale.PortugueseBrazil],
    [siteAgents()[0]!.id, 'de', OwnerLocale.German],
  ])('GET /api/quick-start?agent=%s&language=%s answers the one line and the setup address', async (agent, language, locale) => {
    const body = (await (await siteFetch({ path: `/api/quick-start?agent=${agent}&language=${language}` })).json()) as Record<
      string,
      unknown
    >;
    expect(body.prompt).toBe(promptOf({ locale }));
    expect(body.setupUrl).toBe(`${SITE_ORIGIN}${setupPathOf({ locale })}`);
  });
});

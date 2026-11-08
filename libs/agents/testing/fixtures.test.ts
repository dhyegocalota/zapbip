import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INSTALL_SELF_TEST_TEXT, DocsLanguage, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { guideParityViolationsOf } from '../src/checks/guide-parity';
import type { AgentDefinition, AgentInstall } from '../src/contract';
import { AGENT_PAGE_HEADINGS, AGENT_PAGE_SECTIONS, LISTEN_STATEMENT_TOKENS, WAKE_RUNG_LABELS } from '../src/docs';
import { definition as connectorDefinition } from './fixture-connector-agent/definition';
import { install as connectorInstall } from './fixture-connector-agent/install';
import { definition as agentDefinition } from './fixture-agent/definition';
import { install as agentInstall } from './fixture-agent/install';
import { definition as pluginDefinition } from './fixture-plugin-agent/definition';
import { install as pluginInstall } from './fixture-plugin-agent/install';

const CONNECTION_LINK = 'https://x.example/c/zb_conn_FAKE/mcp';
const PENDING_SECONDS = '50';
const HEADING_PATTERN = /^## (.+)$/gm;
const PAGE_FILE: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'page.en.mdx',
  [DocsLanguage.PortugueseBrazil]: 'page.pt-br.mdx',
};

type Fixture = { folder: string; definition: AgentDefinition; install: AgentInstall; isPluginPage?: boolean };

const FIXTURES: Fixture[] = [
  { folder: 'fixture-agent', definition: agentDefinition, install: agentInstall },
  { folder: 'fixture-connector-agent', definition: connectorDefinition, install: connectorInstall },
  { folder: 'fixture-plugin-agent', definition: pluginDefinition, install: pluginInstall, isPluginPage: true },
];

function pageOf(input: { folder: string; language: DocsLanguage }): string {
  return readFileSync(fileURLToPath(new URL(`./${input.folder}/${PAGE_FILE[input.language]}`, import.meta.url)), 'utf8');
}

describe.each(FIXTURES)('$folder', ({ folder, definition, install, isPluginPage = false }) => {
  test('passes the guide parity check as it is, so a scaffold made from it passes too', () => {
    const guides = {
      [DocsLanguage.English]: pageOf({ folder, language: DocsLanguage.English }),
      [DocsLanguage.PortugueseBrazil]: pageOf({ folder, language: DocsLanguage.PortugueseBrazil }),
    };
    expect(guideParityViolationsOf({ entries: [{ id: folder, install, isPluginPage, guides }] })).toEqual([]);
  });

  describe.each(Object.values(DocsLanguage))('its page in %s', (language) => {
    const page = pageOf({ folder, language });

    test('has the four headings in order', () => {
      const headings = [...page.matchAll(HEADING_PATTERN)].map((match) => match[1]);
      expect(headings).toEqual(AGENT_PAGE_SECTIONS.map((section) => AGENT_PAGE_HEADINGS[language][section]));
    });

    test('states its rung, the pending loop, the re-call and no time limit', () => {
      const lowerCasePage = page.toLowerCase();
      const words = [
        WAKE_RUNG_LABELS[language][definition.listen.rung],
        PENDING_SECONDS,
        ...Object.values(LISTEN_STATEMENT_TOKENS[language]),
      ];
      words.forEach((word) => expect(lowerCasePage).toContain(word.toLowerCase()));
    });

    test('holds every page fact', () => {
      definition.docs.pageFacts[language].forEach((fact) => expect(page).toContain(fact));
    });
  });

  describe.each(Object.values(OwnerLocale))('its install section in %s', (locale) => {
    const section = install.render({ connectionLink: CONNECTION_LINK, locale, standbyAgent: null });
    const stepLines = section.split('\n').filter((line) => /^\d+\. /.test(line));

    test('opens with its product heading and stops first if the agent is another product', () => {
      expect(section.startsWith(`## ${install.productName}`)).toBe(true);
      expect(stepLines[0]).toContain(install.productName);
    });

    test('ends with the self-test and names a success on every step', () => {
      expect(stepLines.at(-1)).toContain(INSTALL_SELF_TEST_TEXT[locale]);
      stepLines.forEach((line) => expect(line).toContain('Success:'));
    });

    test('writes the connection link and renders the same text twice', () => {
      expect(section).toContain(CONNECTION_LINK);
      expect(install.render({ connectionLink: CONNECTION_LINK, locale, standbyAgent: null })).toBe(section);
    });
  });
});

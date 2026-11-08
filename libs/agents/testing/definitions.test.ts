import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INSTALL_SECTIONS } from '@zapbip/core';
import { DocsLanguage, DocsOnlyClient, InstallClient, OwnerLocale, WakeRung } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { AgentDefinition } from '../src/contract';
import { WAKE_RUNG_LABELS } from '../src/docs';
import { GOLDEN_CONNECTION_LINK, matrixRowsByAgentOf, repositoryFile } from './golden-sources';

const SUPPORTED_FOLDER = fileURLToPath(new URL('../supported/', import.meta.url));
const DEFINITION_FILE = 'definition.ts';
const ONE_HOUR_SECONDS = 3600;
const SET_WAKE_MODE_PATTERN = /set_wake\(\{mode: "(\w+)"/g;
const NOT_MEASURED: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'Not measured',
  [DocsLanguage.PortugueseBrazil]: 'Não medido',
};
const SECONDS_WORD: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'seconds',
  [DocsLanguage.PortugueseBrazil]: 'segundos',
};
const HOUR_LABEL: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: '1 hour',
  [DocsLanguage.PortugueseBrazil]: '1 hora',
};
const PAGE_PATH_PREFIX: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: '/agents',
  [DocsLanguage.PortugueseBrazil]: '/pt-br/agents',
};
const PAGES_FOLDER: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'apps/docs/agents',
  [DocsLanguage.PortugueseBrazil]: 'apps/docs/pt-br/agents',
};
const TODAY_SPEAKER_NAMES = [
  'Claude Code',
  'Claude',
  'Codex',
  'ChatGPT',
  'Grok Bot',
  'Grok',
  'Cursor',
  'Gemini CLI',
  'Gemini',
  'Hermes',
  'OpenClaw',
];
const ENUM_MEMBER_PATTERN = /^[A-Z][A-Za-z]*$/;

const agentIds = readdirSync(SUPPORTED_FOLDER, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`${SUPPORTED_FOLDER}${entry.name}/${DEFINITION_FILE}`))
  .map((entry) => entry.name)
  .sort();

const goldenAgentIds = Object.keys(matrixRowsByAgentOf({ language: DocsLanguage.English })).sort();
const definitions: Record<string, AgentDefinition> = Object.fromEntries(
  await Promise.all(agentIds.map(async (id) => [id, (await import(`../supported/${id}/definition.ts`)).definition as AgentDefinition])),
);

function delayLabelOf(input: { expectedDelaySeconds: number | null; language: DocsLanguage }): string {
  if (input.expectedDelaySeconds === null) return NOT_MEASURED[input.language];
  if (input.expectedDelaySeconds === ONE_HOUR_SECONDS) return HOUR_LABEL[input.language];
  return `${input.expectedDelaySeconds} ${SECONDS_WORD[input.language]}`;
}

function enumMemberOf(id: string): string | undefined {
  return Object.entries({ ...InstallClient, ...DocsOnlyClient }).find(([, value]) => value === id)?.[0];
}

describe('the real agent definitions', () => {
  test('there is one definition for each agent the matrix lists', () => {
    expect(agentIds).toEqual(goldenAgentIds);
  });

  describe.each(goldenAgentIds)('%s', (id) => {
    const definition = definitions[id] as AgentDefinition;

    test('keeps the enum member it has today', () => {
      expect(definition.enumMember).toMatch(ENUM_MEMBER_PATTERN);
      expect(definition.enumMember).toBe(enumMemberOf(id));
    });

    test.each(Object.values(DocsLanguage))('renders its matrix row in %s as the golden row', (language) => {
      const { matrixName, linkName } = definition.docs;
      const { rung, expectedDelaySeconds } = definition.listen;
      const row = [
        matrixName[language],
        WAKE_RUNG_LABELS[language][rung],
        delayLabelOf({ expectedDelaySeconds, language }),
        `[${linkName[language]}](${PAGE_PATH_PREFIX[language]}/${id})`,
      ].join(' | ');
      expect(row).toBe(matrixRowsByAgentOf({ language })[id]);
    });

    test.each(Object.values(DocsLanguage))('lists page facts that its page in %s holds', (language) => {
      const page = repositoryFile(`${PAGES_FOLDER[language]}/${id}.mdx`);
      definition.docs.pageFacts[language].forEach((fact) => expect(page).toContain(fact));
    });
  });

  test('the speaker names cover the labels the conversation check lists today', () => {
    const speakerNames = Object.values(definitions).flatMap((definition) => definition.docs.speakerNames);
    TODAY_SPEAKER_NAMES.forEach((name) => expect(speakerNames).toContain(name));
  });

  test('the wake rung of the only inbox agent is the inbox', () => {
    expect(definitions[DocsOnlyClient.AnyMcpClient]?.listen.rung).toBe(WakeRung.Inbox);
  });

  describe.each(Object.values(InstallClient))('the set_wake modes of %s', (client) => {
    test.each(Object.values(OwnerLocale))('in %s match what its install section writes', (locale) => {
      const section = INSTALL_SECTIONS[client]({ connectionLink: GOLDEN_CONNECTION_LINK, locale, standbyAgent: null });
      const written = [...new Set([...section.matchAll(SET_WAKE_MODE_PATTERN)].map((match) => match[1] as string))];
      const allowed = definitions[client]?.listen.setWakeModes as string[];
      expect(written.every((mode) => allowed.includes(mode))).toBe(true);
      expect(written.length > 0).toBe(allowed.length > 0);
    });
  });
});

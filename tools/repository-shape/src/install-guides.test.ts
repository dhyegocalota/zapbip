import { describe, expect, test } from 'vitest';
import { DocsLanguage, InstallClient, OwnerLocale } from '@zapbip/types';
import { AGENT_PAGE_HEADINGS, AGENT_PAGE_SECTIONS, headingsOf } from './docs-experience';
import { readRepositoryFile } from './repository-files';

const DOCS_CONFIG = 'apps/docs/docs.json';
const PLUGIN_PAGE_CLIENTS: InstallClient[] = [InstallClient.Hermes, InstallClient.OpenClaw];
const FRONTMATTER_PATTERN = /^---\ntitle: .+\ndescription: .+\n---\n/;
const CONNECTION_LINK_PLACEHOLDER = '<connectionLink>';
const CODE_PATTERN = /```[\s\S]*?```|`[^`\n]*`/g;
const UNPINNED_PACKAGE_PATTERN = /npx zapbip(?!@)/;
const FORBIDDEN_WORDS = /fake|simulator|localhost|zb_conn_/i;

type GuideLanguage = {
  locale: OwnerLocale;
  docsLanguage: DocsLanguage;
  language: string;
  group: string;
  pagePrefix: string;
  newAgentWords: string;
};

const GUIDE_LANGUAGES: GuideLanguage[] = [
  {
    locale: OwnerLocale.EnglishUs,
    docsLanguage: DocsLanguage.English,
    language: 'en',
    group: 'Agents',
    pagePrefix: 'agents',
    newAgentWords: 'new agent',
  },
  {
    locale: OwnerLocale.PortugueseBrazil,
    docsLanguage: DocsLanguage.PortugueseBrazil,
    language: 'pt-BR',
    group: 'IAs',
    pagePrefix: 'pt-br/agents',
    newAgentWords: 'novo agente',
  },
];

type NavigationNode = string | { group: string; pages: NavigationNode[] };
type LanguageNavigation = { language: string; groups: { group: string; pages: NavigationNode[] }[] };

const languages = JSON.parse(readRepositoryFile(DOCS_CONFIG)).navigation.languages as LanguageNavigation[];

function guidePath({ pagePrefix, client }: { pagePrefix: string; client: InstallClient }): string {
  return `apps/docs/${pagePrefix}/${client}.mdx`;
}

const isStepGuide = ({ client }: { client: InstallClient }): boolean => !PLUGIN_PAGE_CLIENTS.includes(client);

const cases = GUIDE_LANGUAGES.flatMap((guideLanguage) =>
  Object.values(InstallClient).map((client) => ({
    ...guideLanguage,
    client,
    path: guidePath({ pagePrefix: guideLanguage.pagePrefix, client }),
  })),
);

describe('install guides', () => {
  test.each(cases)('IS-D1 $path has frontmatter and exactly the four agent page headings', ({ path, docsLanguage }) => {
    const guide = readRepositoryFile(path);
    expect(guide).toMatch(FRONTMATTER_PATTERN);
    expect(headingsOf({ markdown: guide })).toEqual(AGENT_PAGE_SECTIONS.map((section) => AGENT_PAGE_HEADINGS[docsLanguage][section]));
  });

  test.each(cases.filter(isStepGuide))('$path starts from the official number and pastes a prompt', ({ path, newAgentWords }) => {
    expect(readRepositoryFile(path)).toContain(newAgentWords);
  });

  test.each(cases.filter(isStepGuide))('$path shows the connection link only as the placeholder', ({ path }) => {
    const guide = readRepositoryFile(path);
    expect(guide).toContain(CONNECTION_LINK_PLACEHOLDER);
    expect(guide.replace(CODE_PATTERN, '')).not.toContain(CONNECTION_LINK_PLACEHOLDER);
    expect(guide).not.toMatch(FORBIDDEN_WORDS);
  });

  test.each(cases.filter((guideCase) => !isStepGuide(guideCase)))('$path never names a test double', ({ path }) => {
    expect(readRepositoryFile(path)).not.toMatch(FORBIDDEN_WORDS);
  });

  test.each(cases)('$path pins the connector package version', ({ path }) => {
    expect(readRepositoryFile(path)).not.toMatch(UNPINNED_PACKAGE_PATTERN);
  });

  test.each(GUIDE_LANGUAGES)('IS-D4 the $language $group group lists the ten guides', ({ language, group, pagePrefix }) => {
    const navigation = languages.find((entry) => entry.language === language);
    const pages = navigation?.groups.find((entry) => entry.group === group)?.pages;
    const expected = Object.values(InstallClient).map((client) => `${pagePrefix}/${client}`);
    expect(pages).toEqual(expect.arrayContaining(expected));
  });
});

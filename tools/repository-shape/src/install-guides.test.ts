import { describe, expect, test } from 'vitest';
import { InstallClient, OwnerLocale } from '@zapbip/types';
import { readRepositoryFile } from './repository-files';

const DOCS_CONFIG = 'apps/docs/docs.json';
const SECTION_HEADING_PATTERN = /^## .+$/gm;
const SECTIONS_PER_GUIDE = 3;
const FRONTMATTER_PATTERN = /^---\ntitle: .+\ndescription: .+\n---\n/;
const CONNECTION_LINK_PLACEHOLDER = '<connectionLink>';
const CODE_PATTERN = /```[\s\S]*?```|`[^`\n]*`/g;
const UNPINNED_PACKAGE_PATTERN = /npx zapbip(?!@)/;
const FORBIDDEN_WORDS = /fake|simulator|localhost|zb_conn_/i;

type GuideLanguage = { locale: OwnerLocale; language: string; group: string; pagePrefix: string; newAgentWords: string };

const GUIDE_LANGUAGES: GuideLanguage[] = [
  { locale: OwnerLocale.EnglishUs, language: 'en', group: 'Agents', pagePrefix: 'agents', newAgentWords: 'new agent' },
  { locale: OwnerLocale.PortugueseBrazil, language: 'pt-BR', group: 'IAs', pagePrefix: 'pt-br/agents', newAgentWords: 'novo agente' },
];

type NavigationNode = string | { group: string; pages: NavigationNode[] };
type LanguageNavigation = { language: string; groups: { group: string; pages: NavigationNode[] }[] };

const languages = JSON.parse(readRepositoryFile(DOCS_CONFIG)).navigation.languages as LanguageNavigation[];

function guidePath({ pagePrefix, client }: { pagePrefix: string; client: InstallClient }): string {
  return `apps/docs/${pagePrefix}/${client}.mdx`;
}

const cases = GUIDE_LANGUAGES.flatMap((guideLanguage) =>
  Object.values(InstallClient).map((client) => ({
    ...guideLanguage,
    client,
    path: guidePath({ pagePrefix: guideLanguage.pagePrefix, client }),
  })),
);

describe('install guides', () => {
  test.each(cases)('IS-D1 $path has frontmatter and exactly the three sections', ({ path }) => {
    const guide = readRepositoryFile(path);
    expect(guide).toMatch(FRONTMATTER_PATTERN);
    expect(guide.match(SECTION_HEADING_PATTERN)).toHaveLength(SECTIONS_PER_GUIDE);
  });

  test.each(cases)('$path starts from the official number and pastes a prompt', ({ path, newAgentWords }) => {
    expect(readRepositoryFile(path)).toContain(newAgentWords);
  });

  test.each(cases)('$path shows the connection link only as the placeholder', ({ path }) => {
    const guide = readRepositoryFile(path);
    expect(guide).toContain(CONNECTION_LINK_PLACEHOLDER);
    expect(guide.replace(CODE_PATTERN, '')).not.toContain(CONNECTION_LINK_PLACEHOLDER);
    expect(guide).not.toMatch(FORBIDDEN_WORDS);
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

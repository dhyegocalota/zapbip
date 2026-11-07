import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const DOCS_ROOT = 'apps/docs';
const DOCS_CONFIG_FILE = `${DOCS_ROOT}/docs.json`;
const DEFAULT_LANGUAGE = 'en';
const TRANSLATED_LANGUAGE = 'pt-BR';
const TRANSLATED_DIRECTORY = 'pt-br';
const CHANNEL_PAGE = 'concepts/whatsapp-channel';
const NOTICES_PAGE = 'concepts/owner-notices';
const PAGE_EXTENSION = '.mdx';

const THOUSANDS_SEPARATOR = ',';
const TRANSLATED_THOUSANDS_SEPARATOR = '.';
const CHANNEL_LIMITS = ['4,096', '1,024', '3', '20', '10', '24', '72', '5 MB', '16 MB', '100 MB', '100 KB', '30', '24'];
const NOTICE_TERMS = ['zapbip_agent_notice', 'zapbip_agent_question', 'Abrir', 'Open', 'Responder', 'Reply'];
const NOTICE_SENTENCE_BY_LANGUAGE: Record<string, string> = {
  [DEFAULT_LANGUAGE]: 'before the real content',
  [TRANSLATED_LANGUAGE]: 'antes do conteúdo de verdade',
};

type NavigationNode = string | { group: string; pages: NavigationNode[] };
type LanguageNavigation = { language: string; groups: { group: string; pages: NavigationNode[] }[] };

function pagesOf(nodes: NavigationNode[]): string[] {
  return nodes.flatMap((node) => (typeof node === 'string' ? [node] : pagesOf(node.pages)));
}

function navigationPages(language: string): string[] {
  const languages: LanguageNavigation[] = JSON.parse(readRepositoryFile(DOCS_CONFIG_FILE)).navigation.languages;
  const navigation = languages.find((entry) => entry.language === language);
  if (!navigation) throw new Error(`${DOCS_CONFIG_FILE} has no ${language} navigation`);
  return pagesOf(navigation.groups.flatMap((group) => group.pages));
}

function pagePath({ language, page }: { language: string; page: string }): string {
  return language === DEFAULT_LANGUAGE ? page : `${TRANSLATED_DIRECTORY}/${page}`;
}

function pageSource({ language, page }: { language: string; page: string }): string {
  return readRepositoryFile(`${DOCS_ROOT}/${pagePath({ language, page })}${PAGE_EXTENSION}`);
}

const cases = [DEFAULT_LANGUAGE, TRANSLATED_LANGUAGE].flatMap((language) =>
  [CHANNEL_PAGE, NOTICES_PAGE].map((page) => ({ language, page })),
);

describe('whatsapp channel docs', () => {
  test.each(cases)('$page exists and is in the $language navigation', ({ language, page }) => {
    const path = pagePath({ language, page });
    expect(existsSync(repositoryPath(`${DOCS_ROOT}/${path}${PAGE_EXTENSION}`))).toBe(true);
    expect(navigationPages(language)).toContain(path);
  });

  test.each([DEFAULT_LANGUAGE, TRANSLATED_LANGUAGE])('DOC-3 the %s channel page states every limit', (language) => {
    const source = pageSource({ language, page: CHANNEL_PAGE });
    const limits =
      language === TRANSLATED_LANGUAGE
        ? CHANNEL_LIMITS.map((limit) => limit.replace(THOUSANDS_SEPARATOR, TRANSLATED_THOUSANDS_SEPARATOR))
        : CHANNEL_LIMITS;
    expect(limits.filter((limit) => !source.includes(limit))).toEqual([]);
  });

  test.each([DEFAULT_LANGUAGE, TRANSLATED_LANGUAGE])('the %s notices page names both templates and the quick replies', (language) => {
    const source = pageSource({ language, page: NOTICES_PAGE });
    expect(NOTICE_TERMS.filter((term) => !source.includes(term))).toEqual([]);
    expect(source).toContain(NOTICE_SENTENCE_BY_LANGUAGE[language]);
  });
});

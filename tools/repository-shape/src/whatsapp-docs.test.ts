import { existsSync } from 'node:fs';
import { DocsPageLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { twinPathOf } from './docs-experience';
import { readRepositoryFile, repositoryPath } from './repository-files';

const DOCS_ROOT = 'apps/docs';
const DOCS_CONFIG_FILE = `${DOCS_ROOT}/docs.json`;
const LANGUAGES = Object.values(DocsPageLanguage);
const CHANNEL_PAGE = 'concepts/whatsapp-channel';
const NOTICES_PAGE = 'concepts/owner-notices';
const PAGE_EXTENSION = '.mdx';

const THOUSANDS_SEPARATOR_PATTERN = /(\d)[,.\u00a0\u202f](?=\d{3}\b)/g;
const CHANNEL_LIMITS = ['4096', '1024', '3', '20', '10', '24', '72', '5 MB', '16 MB', '100 MB', '100 KB', '30', '24'];
const NOTICE_TERMS = ['zapbip_agent_notice', 'zapbip_agent_question', 'Abrir', 'Open', 'Responder', 'Reply'];
const NOTICE_SENTENCE_BY_LANGUAGE: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'before the real content',
  [DocsPageLanguage.PortugueseBrazil]: 'antes do conteúdo de verdade',
  [DocsPageLanguage.Spanish]: 'antes del contenido real',
  [DocsPageLanguage.German]: 'vor dem eigentlichen Inhalt',
  [DocsPageLanguage.French]: 'avant le vrai contenu',
  [DocsPageLanguage.Japanese]: '本来の内容の前',
  [DocsPageLanguage.Korean]: '실제 내용보다 앞에',
  [DocsPageLanguage.Chinese]: '在真正的内容之前',
};

type NavigationNode = string | { group: string; pages: NavigationNode[] };
type LanguageNavigation = { language: string; groups: { group: string; pages: NavigationNode[] }[] };

function pagesOf(nodes: NavigationNode[]): string[] {
  return nodes.flatMap((node) => (typeof node === 'string' ? [node] : pagesOf(node.pages)));
}

function navigationPages(language: DocsPageLanguage): string[] {
  const languages: LanguageNavigation[] = JSON.parse(readRepositoryFile(DOCS_CONFIG_FILE)).navigation.languages;
  const navigation = languages.find((entry) => entry.language === language);
  if (!navigation) throw new Error(`${DOCS_CONFIG_FILE} has no ${language} navigation`);
  return pagesOf(navigation.groups.flatMap((group) => group.pages));
}

function pagePath({ language, page }: { language: DocsPageLanguage; page: string }): string {
  return twinPathOf({ path: page, language });
}

function pageSource({ language, page }: { language: DocsPageLanguage; page: string }): string {
  return readRepositoryFile(`${DOCS_ROOT}/${pagePath({ language, page })}${PAGE_EXTENSION}`);
}

const cases = LANGUAGES.flatMap((language) => [CHANNEL_PAGE, NOTICES_PAGE].map((page) => ({ language, page })));

describe('whatsapp channel docs', () => {
  test.each(cases)('$page exists and is in the $language navigation', ({ language, page }) => {
    const path = pagePath({ language, page });
    expect(existsSync(repositoryPath(`${DOCS_ROOT}/${path}${PAGE_EXTENSION}`))).toBe(true);
    expect(navigationPages(language)).toContain(path);
  });

  test.each(LANGUAGES)('DOC-3 the %s channel page states every limit', (language) => {
    const source = pageSource({ language, page: CHANNEL_PAGE }).replace(THOUSANDS_SEPARATOR_PATTERN, '$1');
    expect(CHANNEL_LIMITS.filter((limit) => !source.includes(limit))).toEqual([]);
  });

  test.each(LANGUAGES)('the %s notices page names both templates and the quick replies', (language) => {
    const source = pageSource({ language, page: NOTICES_PAGE });
    expect(NOTICE_TERMS.filter((term) => !source.includes(term))).toEqual([]);
    expect(source).toContain(NOTICE_SENTENCE_BY_LANGUAGE[language]);
  });
});

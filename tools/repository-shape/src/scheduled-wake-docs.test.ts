import { DocsPageLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { twinPathOf } from './docs-experience';
import { DOCS_ROOT, readRepositoryFile } from './repository-files';

const LANGUAGES = Object.values(DocsPageLanguage);
const pagesOf = (path: string): string[] => LANGUAGES.map((language) => twinPathOf({ path, language }));
const WAKE_LADDER_PAGES = pagesOf('concepts/wake-ladder.mdx');
const SET_WAKE_PAGES = pagesOf('mcp-reference/set-wake.mdx');
const ONE_HOP_PHRASES: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'A standby never forwards to another standby',
  [DocsPageLanguage.PortugueseBrazil]: 'Uma conexão em espera nunca repassa para outra em espera',
  [DocsPageLanguage.Spanish]: 'Una conexión en espera nunca reenvía a otra en espera',
  [DocsPageLanguage.German]: 'Eine Bereitschaftsverbindung leitet nie an eine weitere Bereitschaftsverbindung weiter',
  [DocsPageLanguage.French]: 'Une connexion en veille ne transfère jamais vers une autre en veille',
  [DocsPageLanguage.Japanese]: '待機の接続が別の待機の接続へ転送することはありません',
  [DocsPageLanguage.Korean]: '대기 연결은 다른 대기 연결로 전달하지 않습니다',
  [DocsPageLanguage.Chinese]: '待命连接绝不会转发给另一个待命连接',
  [DocsPageLanguage.Arabic]: 'لا يُحوَّل اتصال احتياطي أبدًا إلى اتصال احتياطي آخر',
};
const ONE_HOP_WORDS: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'one hop',
  [DocsPageLanguage.PortugueseBrazil]: 'um salto',
  [DocsPageLanguage.Spanish]: 'un salto',
  [DocsPageLanguage.German]: 'ein Hop',
  [DocsPageLanguage.French]: 'un saut',
  [DocsPageLanguage.Japanese]: '1 ホップ',
  [DocsPageLanguage.Korean]: '1홉',
  [DocsPageLanguage.Chinese]: '一跳',
  [DocsPageLanguage.Arabic]: 'قفزة واحدة',
};
const TOOL_FIELD_PATTERN = /mode:\s*local|"mode"|interval_minutes|standby_agent/;

function pageText(page: string): string {
  return readRepositoryFile(`${DOCS_ROOT}/${page}`);
}

describe('scheduled wake docs', () => {
  test.each(
    LANGUAGES.flatMap((language) =>
      [WAKE_LADDER_PAGES, SET_WAKE_PAGES].map((pages) => ({ language, page: pages[LANGUAGES.indexOf(language)] as string })),
    ),
  )('$page states the one-hop standby rule', ({ language, page }) => {
    const text = pageText(page);
    expect(text).toContain(ONE_HOP_PHRASES[language]);
    expect(text).toContain(ONE_HOP_WORDS[language]);
  });

  test.each(WAKE_LADDER_PAGES)('%s names no tool field on the main path', (page) => {
    expect(pageText(page)).not.toMatch(TOOL_FIELD_PATTERN);
  });
});

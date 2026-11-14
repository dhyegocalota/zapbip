import { existsSync } from 'node:fs';
import { COMMAND_WORDS } from '@zapbip/core';
import { CommandKind, DOCS_OWNER_LOCALES, DocsPageLanguage, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { twinPathOf } from './docs-experience';
import { readRepositoryFile, repositoryPath } from './repository-files';

const DOCS_CONFIG = 'apps/docs/docs.json';
const DOCS_ROOT = 'apps/docs';
const PAGE_EXTENSION = '.mdx';
const INTERNAL_LINK_PATTERN = /\]\((\/[^)#\s]+)/g;
const COMMANDS_PAGE = 'features/whatsapp-commands';
const MANAGE_PAGE = 'features/manage-your-agents';
const DELETE_PAGE = 'help/delete-your-account';
const ACCOUNT_PAGES = [COMMANDS_PAGE, MANAGE_PAGE, DELETE_PAGE];

type Language = { name: string; docsLanguage: DocsPageLanguage; historyStatement: RegExp };

const LANGUAGES: Language[] = [
  {
    name: 'English',
    docsLanguage: DocsPageLanguage.English,
    historyStatement: /WhatsApp keeps the chat history/,
  },
  {
    name: 'Portuguese',
    docsLanguage: DocsPageLanguage.PortugueseBrazil,
    historyStatement: /O WhatsApp guarda o histórico/,
  },
  {
    name: 'Spanish',
    docsLanguage: DocsPageLanguage.Spanish,
    historyStatement: /WhatsApp guarda el historial/,
  },
  {
    name: 'German',
    docsLanguage: DocsPageLanguage.German,
    historyStatement: /WhatsApp behält den Chatverlauf/,
  },
  {
    name: 'French',
    docsLanguage: DocsPageLanguage.French,
    historyStatement: /WhatsApp conserve l'historique/,
  },
  {
    name: 'Japanese',
    docsLanguage: DocsPageLanguage.Japanese,
    historyStatement: /チャット履歴は WhatsApp に残ります/,
  },
  {
    name: 'Korean',
    docsLanguage: DocsPageLanguage.Korean,
    historyStatement: /대화 기록은 WhatsApp에 남습니다/,
  },
  {
    name: 'Chinese',
    docsLanguage: DocsPageLanguage.Chinese,
    historyStatement: /聊天记录会保留在 WhatsApp/,
  },
];

function pagePath(input: { docsLanguage: DocsPageLanguage; page: string }): string {
  return `${DOCS_ROOT}/${twinPathOf({ path: input.page, language: input.docsLanguage })}${PAGE_EXTENSION}`;
}

function commandWordsOf(input: { locale: OwnerLocale }): string[] {
  return COMMAND_WORDS.filter((entry) => entry.locale === input.locale).map((entry) => entry.words);
}

function confirmationPhraseOf(input: { docsLanguage: DocsPageLanguage }): string {
  const locale = DOCS_OWNER_LOCALES[input.docsLanguage];
  return COMMAND_WORDS.find((entry) => entry.kind === CommandKind.ConfirmDeletion && entry.locale === locale)!.words;
}

describe.each(LANGUAGES)('account guides in $name', (language) => {
  test.each(ACCOUNT_PAGES)('[row 434][row 435][row 436] %s is in the navigation and its internal links resolve', (page) => {
    expect(readRepositoryFile(DOCS_CONFIG)).toContain(`"${twinPathOf({ path: page, language: language.docsLanguage })}"`);
    const text = readRepositoryFile(pagePath({ docsLanguage: language.docsLanguage, page }));
    const links = [...text.matchAll(INTERNAL_LINK_PATTERN)].map(([, link]) => (link as string).slice(1));
    const missing = links.filter((link) => !existsSync(repositoryPath(`${DOCS_ROOT}/${link}${PAGE_EXTENSION}`)));
    expect(missing).toEqual([]);
  });

  test('[row 437] the commands page lists every command word of the language', () => {
    const text = readRepositoryFile(pagePath({ docsLanguage: language.docsLanguage, page: COMMANDS_PAGE }));
    const missing = commandWordsOf({ locale: DOCS_OWNER_LOCALES[language.docsLanguage] }).filter((words) => !text.includes(words));
    expect(missing).toEqual([]);
  });

  test('[row 438] the delete page holds the confirmation phrase and says the chat history stays with WhatsApp', () => {
    const text = readRepositoryFile(pagePath({ docsLanguage: language.docsLanguage, page: DELETE_PAGE }));
    expect(text).toContain(confirmationPhraseOf({ docsLanguage: language.docsLanguage }));
    expect(text).toMatch(language.historyStatement);
  });
});

import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const DOCS_CONFIG = 'apps/docs/docs.json';
const COMMAND_WORDS_FILE = 'libs/core/src/accounts/command-words.ts';
const DOCS_ROOT = 'apps/docs';
const PAGE_EXTENSION = '.mdx';
const COMMAND_WORD_PATTERN = /locale: OwnerLocale\.(\w+), words: '([^']+)'/g;
const INTERNAL_LINK_PATTERN = /\]\((\/[^)#\s]+)/g;
const COMMANDS_PAGE = 'features/whatsapp-commands';
const MANAGE_PAGE = 'features/manage-your-agents';
const DELETE_PAGE = 'help/delete-your-account';
const ACCOUNT_PAGES = [COMMANDS_PAGE, MANAGE_PAGE, DELETE_PAGE];
const TRANSLATED_PREFIX = 'pt-br/';

type Language = { name: string; prefix: string; localeKey: string; confirmationPhrase: string; historyStatement: RegExp };

const LANGUAGES: Language[] = [
  {
    name: 'English',
    prefix: '',
    localeKey: 'EnglishUs',
    confirmationPhrase: 'delete account permanently',
    historyStatement: /WhatsApp keeps the chat history/,
  },
  {
    name: 'Portuguese',
    prefix: TRANSLATED_PREFIX,
    localeKey: 'PortugueseBrazil',
    confirmationPhrase: 'apagar conta definitivamente',
    historyStatement: /O WhatsApp guarda o histórico/,
  },
];

function pagePath(input: { prefix: string; page: string }): string {
  return `${DOCS_ROOT}/${input.prefix}${input.page}${PAGE_EXTENSION}`;
}

function commandWordsOf(input: { localeKey: string }): string[] {
  const source = readRepositoryFile(COMMAND_WORDS_FILE);
  return [...source.matchAll(COMMAND_WORD_PATTERN)]
    .filter(([, localeKey]) => localeKey === input.localeKey)
    .map(([, , words]) => words as string);
}

describe.each(LANGUAGES)('account guides in $name', (language) => {
  test.each(ACCOUNT_PAGES)('[row 434][row 435][row 436] %s is in the navigation and its internal links resolve', (page) => {
    expect(readRepositoryFile(DOCS_CONFIG)).toContain(`"${language.prefix}${page}"`);
    const text = readRepositoryFile(pagePath({ prefix: language.prefix, page }));
    const links = [...text.matchAll(INTERNAL_LINK_PATTERN)].map(([, link]) => (link as string).slice(1));
    const missing = links.filter((link) => !existsSync(repositoryPath(`${DOCS_ROOT}/${link}${PAGE_EXTENSION}`)));
    expect(missing).toEqual([]);
  });

  test('[row 437] the commands page lists every command word of the language', () => {
    const text = readRepositoryFile(pagePath({ prefix: language.prefix, page: COMMANDS_PAGE }));
    const missing = commandWordsOf({ localeKey: language.localeKey }).filter((words) => !text.includes(words));
    expect(missing).toEqual([]);
  });

  test('[row 438] the delete page holds the confirmation phrase and says the chat history stays with WhatsApp', () => {
    const text = readRepositoryFile(pagePath({ prefix: language.prefix, page: DELETE_PAGE }));
    expect(text).toContain(language.confirmationPhrase);
    expect(text).toMatch(language.historyStatement);
  });
});

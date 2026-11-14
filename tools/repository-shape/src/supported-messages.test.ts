import { DocsPageLanguage, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { twinPathOf } from './docs-experience';
import { DOCS_ROOT, PAGE_EXTENSION, capturedNames, readRepositoryFile } from './repository-files';

const SUPPORTED_MESSAGES_PAGE = 'features/supported-messages';
const LANGUAGES = Object.values(DocsPageLanguage);
const KIND_ROW_PATTERN = /^\|\s*`([a-z]+)`/gm;

function missingKindsOf(input: { source: string; kinds: MessageKind[] }): MessageKind[] {
  const listed = capturedNames({ text: input.source, pattern: KIND_ROW_PATTERN });
  return input.kinds.filter((kind) => !listed.includes(kind));
}

function pageSourceOf(language: DocsPageLanguage): string {
  return readRepositoryFile(`${DOCS_ROOT}/${twinPathOf({ path: SUPPORTED_MESSAGES_PAGE, language })}${PAGE_EXTENSION}`);
}

describe('supported messages page', () => {
  test.each(LANGUAGES)('the %s page lists every MessageKind in its tables', (language) => {
    expect(missingKindsOf({ source: pageSourceOf(language), kinds: Object.values(MessageKind) })).toEqual([]);
  });

  test('a page without the choice kind fails naming it', () => {
    expect(missingKindsOf({ source: '| `text` | a |', kinds: [MessageKind.Text, MessageKind.Choice] })).toEqual([MessageKind.Choice]);
  });
});

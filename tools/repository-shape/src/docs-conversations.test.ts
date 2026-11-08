import { AGENT_DEFINITIONS } from '@zapbip/agents/definitions';
import { describe, expect, test } from 'vitest';
import { DOCS_ROOT, documentFiles, readRepositoryFile } from './repository-files';

const CHAT_IMPORT = "import { Chat } from '/snippets/chat.jsx';";
const CHAT_USAGE = '<Chat';
const LINE_SEPARATOR = '\n';
const FIXED_SPEAKER_LABELS = ['Owner', 'You', 'Dono', 'Você', 'Voce', 'Agent', 'Agente', 'zapbip'];
const SPEAKER_LABELS = [
  ...FIXED_SPEAKER_LABELS,
  ...Object.values(AGENT_DEFINITIONS).flatMap((definition) => definition.docs.speakerNames),
].sort((left, right) => right.length - left.length);
const LABEL_ALTERNATIVES = SPEAKER_LABELS.map((label) => label.replace(' ', '\\s')).join('|');
const SPEAKER_LINE_PATTERN = new RegExp(`^\\s*(>\\s*)?(\\*{1,2})?(${LABEL_ALTERNATIVES})(\\*{1,2})?(:|\\s{2,}\\S)`, 'i');

const pages = documentFiles('');

function speakerLines(page: string): string[] {
  return readRepositoryFile(`${DOCS_ROOT}/${page}`)
    .split(LINE_SEPARATOR)
    .filter((line) => SPEAKER_LINE_PATTERN.test(line));
}

describe('docs conversations', () => {
  test('there are pages to check', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  test.each(pages)('%s shows no conversation outside <Chat>', (page) => {
    expect(speakerLines(page)).toEqual([]);
  });

  test.each(pages)('%s imports Chat from the shared snippet when it uses it', (page) => {
    const text = readRepositoryFile(`${DOCS_ROOT}/${page}`);
    const usesChat = text.includes(CHAT_USAGE);
    const importsChat = text.includes(CHAT_IMPORT);
    expect(usesChat).toBe(importsChat);
  });
});

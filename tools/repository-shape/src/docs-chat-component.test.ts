import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const CHAT_COMPONENT_FILE = 'apps/docs/snippets/chat.jsx';
const EXPORT_PATTERN = /^export /gm;
const SVG_PATTERN = /<svg\b[^>]*>/g;
const DESTRUCTURED_DEFAULT_PATTERN = /export const Chat = \(\{[^}]*\bcontact = '[^']+'[^}]*\}\)/;
const CONTACT_TERNARY_PATTERN = /contact \?/;
const GROUP_ROLE = 'role="group"';
const LABEL_ATTRIBUTE = 'aria-label=';
const HIDDEN_ATTRIBUTE = 'aria-hidden="true"';
const GENERIC_CARD_FALLBACK = 'return renderDocument(media);';

const source = readRepositoryFile(CHAT_COMPONENT_FILE);

describe('docs chat component', () => {
  test('it exports a single component', () => {
    expect(source.match(EXPORT_PATTERN)).toHaveLength(1);
  });

  test('the contact has a destructured default and no ternary fallback', () => {
    expect(source).toMatch(DESTRUCTURED_DEFAULT_PATTERN);
    expect(source).not.toMatch(CONTACT_TERNARY_PATTERN);
  });

  test('every svg is hidden from assistive technology', () => {
    const svgs = source.match(SVG_PATTERN);
    expect(svgs).not.toBeNull();
    expect(svgs?.filter((svg) => !svg.includes(HIDDEN_ATTRIBUTE))).toEqual([]);
  });

  test('the conversation is a labelled group', () => {
    expect(source).toContain(GROUP_ROLE);
    expect(source).toContain(LABEL_ATTRIBUTE);
  });

  test('an unknown media kind renders the generic file card', () => {
    expect(source).toContain(GENERIC_CARD_FALLBACK);
  });
});

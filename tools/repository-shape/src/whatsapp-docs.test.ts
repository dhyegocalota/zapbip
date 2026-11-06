import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';
import { existsSync } from 'node:fs';

const DOCS_CONFIG_FILE = 'apps/docs/docs.json';
const CONCEPTS_GROUP = 'Concepts';
const CHANNEL_PAGE = 'concepts/whatsapp-channel';
const NOTICES_PAGE = 'concepts/owner-notices';
const PAGE_EXTENSION = '.mdx';

const CHANNEL_LIMITS = [
  '4,096 characters',
  '1,024 characters',
  '3 buttons',
  '20 characters',
  '10 rows',
  '24 characters',
  '72 characters',
  '5 MB',
  '16 MB',
  '100 MB',
  '100 KB',
  '30 days',
  '24 hours',
];
const NOTICE_TERMS = ['zapbip_agent_notice', 'zapbip_agent_question', 'Abrir', 'Open', 'Responder', 'Reply', 'before the real content'];

type DocsConfig = { navigation: { groups: { group: string; pages: string[] }[] } };

function pageSource(page: string): string {
  return readRepositoryFile(`apps/docs/${page}${PAGE_EXTENSION}`);
}

function conceptPages(): string[] {
  const config: DocsConfig = JSON.parse(readRepositoryFile(DOCS_CONFIG_FILE));
  const conceptsGroup = config.navigation.groups.find((group) => group.group === CONCEPTS_GROUP);
  if (!conceptsGroup) throw new Error(`${DOCS_CONFIG_FILE} has no ${CONCEPTS_GROUP} group`);
  return conceptsGroup.pages;
}

describe('whatsapp channel docs', () => {
  test.each([CHANNEL_PAGE, NOTICES_PAGE])('%s exists and is in the concepts navigation', (page) => {
    expect(existsSync(repositoryPath(`apps/docs/${page}${PAGE_EXTENSION}`))).toBe(true);
    expect(conceptPages()).toContain(page);
  });

  test.each(CHANNEL_LIMITS)('the channel page states %s', (limit) => {
    expect(pageSource(CHANNEL_PAGE)).toContain(limit);
  });

  test.each(NOTICE_TERMS)('the notices page states %s', (term) => {
    expect(pageSource(NOTICES_PAGE)).toContain(term);
  });
});

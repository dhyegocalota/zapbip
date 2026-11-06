import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const CONSTANTS_FILE = 'libs/types/src/constants.ts';
const DOCS_CONFIG = 'apps/docs/docs.json';
const COMPANY_SNIPPETS = ['apps/docs/snippets/company.mdx', 'apps/docs/snippets/pt-br/company.mdx'];
const ABOUT_PAGES = ['apps/docs/help/about.mdx', 'apps/docs/pt-br/help/about.mdx'];
const FOOTER_LINES = ['zapbip is a product of Logic Bit', 'zapbip é um produto da Logic Bit'];
const FOOTER_HREFS = ['/help/about', '/pt-br/help/about'];
const UNSET_SENTINEL_PATTERN = /export const COMPANY_FACT_UNSET = '([^']+)'/;
const COMPANY_BLOCK_PATTERN = /export const COMPANY = \{([^}]+)\}/;
const COMPANY_ENTRY_PATTERN = /(\w+): (COMPANY_FACT_UNSET|'[^']*'),/g;
const README_FILE = 'README.md';

function companyFacts(): string[] {
  const source = readRepositoryFile(CONSTANTS_FILE);
  const sentinel = UNSET_SENTINEL_PATTERN.exec(source)?.[1];
  const block = COMPANY_BLOCK_PATTERN.exec(source)?.[1];
  if (!sentinel || !block) throw new Error('COMPANY is missing from libs/types');
  return [...block.matchAll(COMPANY_ENTRY_PATTERN)].flatMap(([, , literal]) =>
    literal === undefined ? [] : [literal === 'COMPANY_FACT_UNSET' ? sentinel : literal.slice(1, -1)],
  );
}

describe('company docs', () => {
  test('the constant declares six facts', () => {
    expect(companyFacts()).toHaveLength(6);
  });

  test.each(COMPANY_SNIPPETS)('%s renders every company fact', (snippet) => {
    const text = readRepositoryFile(snippet);
    const missing = companyFacts().filter((fact) => !text.includes(fact));
    expect(missing).toEqual([]);
  });

  test.each(ABOUT_PAGES)('%s renders the company snippet', (page) => {
    expect(readRepositoryFile(page)).toContain('company.mdx');
  });

  test('the footer carries the product line in both languages and links the about pages', () => {
    const items = JSON.parse(readRepositoryFile(DOCS_CONFIG)).footer.links.flatMap(
      (column: { items: { label: string; href: string }[] }) => column.items,
    );
    expect(items.map((item: { label: string }) => item.label)).toEqual(FOOTER_LINES);
    expect(items.map((item: { href: string }) => item.href)).toEqual(FOOTER_HREFS);
  });

  test('the README states the company', () => {
    expect(readRepositoryFile(README_FILE)).toContain(FOOTER_LINES[0]);
  });
});

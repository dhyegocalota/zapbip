import { describe, expect, test } from 'vitest';
import { DOCS_ROOT, documentFiles, readRepositoryFile } from './repository-files';

const CONSTANTS_FILE = 'libs/types/src/constants.ts';
const DOCS_CONFIG = 'apps/docs/docs.json';
const COMPANY_SNIPPETS = ['apps/docs/snippets/company.mdx', 'apps/docs/snippets/pt-br/company.mdx'];
const ABOUT_PAGES = ['apps/docs/help/about.mdx', 'apps/docs/pt-br/help/about.mdx'];
const FOOTER_LABEL = 'zapbip · Logic Bit';
const FOOTER_HREF = '/help/about';
const README_PRODUCT_LINE = 'zapbip is a product of Logic Bit';
const UNSET_SENTINEL_PATTERN = /export const COMPANY_FACT_UNSET = '([^']+)'/;
const COMPANY_BLOCK_PATTERN = /export const COMPANY = \{([^}]+)\}/;
const COMPANY_ENTRY_PATTERN = /(\w+): (COMPANY_FACT_UNSET|'[^']*'),/g;
const README_FILE = 'README.md';

function setCompanyFacts(): string[] {
  return companyFacts().filter((fact) => fact !== unsetSentinel());
}

function unsetSentinel(): string {
  const sentinel = UNSET_SENTINEL_PATTERN.exec(readRepositoryFile(CONSTANTS_FILE))?.[1];
  if (!sentinel) throw new Error('COMPANY_FACT_UNSET is missing from libs/types');
  return sentinel;
}

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

  test.each(COMPANY_SNIPPETS)('%s renders every company fact that is set', (snippet) => {
    const text = readRepositoryFile(snippet);
    const missing = setCompanyFacts().filter((fact) => !text.includes(fact));
    expect(missing).toEqual([]);
  });

  test('no docs page renders the unset sentinel', () => {
    const sentinel = unsetSentinel();
    const offenders = documentFiles('').filter((page) => readRepositoryFile(`${DOCS_ROOT}/${page}`).includes(sentinel));
    expect(offenders).toEqual([]);
  });

  test.each(ABOUT_PAGES)('%s renders the company snippet', (page) => {
    expect(readRepositoryFile(page)).toContain('company.mdx');
  });

  test('the footer carries one neutral line linking the about page', () => {
    const items = JSON.parse(readRepositoryFile(DOCS_CONFIG)).footer.links.flatMap(
      (column: { items: { label: string; href: string }[] }) => column.items,
    );
    expect(items.map((item: { label: string }) => item.label)).toEqual([FOOTER_LABEL]);
    expect(items.map((item: { href: string }) => item.href)).toEqual([FOOTER_HREF]);
  });

  test('the README states the company', () => {
    expect(readRepositoryFile(README_FILE)).toContain(README_PRODUCT_LINE);
  });
});

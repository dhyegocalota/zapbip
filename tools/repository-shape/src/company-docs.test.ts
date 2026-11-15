import { COMPANY, COMPANY_FACT_UNSET, DocsPageLanguage } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { snippetPathOf, twinPathOf } from './docs-experience';
import { DOCS_ROOT, documentFiles, readRepositoryFile } from './repository-files';

const DOCS_CONFIG = 'apps/docs/docs.json';
const COMPANY_SNIPPETS = Object.values(DocsPageLanguage).map(
  (language) => `${DOCS_ROOT}/${snippetPathOf({ name: 'company.mdx', language })}`,
);
const LICENSE_PAGES = Object.values(DocsPageLanguage).map(
  (language) => `${DOCS_ROOT}/${twinPathOf({ path: 'open-source/license.mdx', language })}`,
);
const FOOTER_LABEL = 'zapbip · Logic Bit';
const FOOTER_HREF = '/open-source/license';
const README_PRODUCT_LINE = 'zapbip is a product of Logic Bit';
const README_FILE = 'README.md';
const COMPANY_FACT_COUNT = 5;
const TABLE_ROW_PREFIX = '|';
const TABLE_HEADER_ROW_COUNT = 2;
const LINE_SEPARATOR = '\n';

const PUBLISHED_COMPANY_FACTS = {
  tradeName: 'Logic Bit',
  legalName: 'Logic Bit AI Software Boutique Ltda',
  cnpj: '32.555.315/0001-91',
  website: 'https://logicbit.com.br',
  contactEmail: 'support@zapbip.com',
};

const companyFacts: string[] = Object.values(COMPANY);

function tableRowCount(snippet: string): number {
  return readRepositoryFile(snippet)
    .split(LINE_SEPARATOR)
    .filter((line) => line.startsWith(TABLE_ROW_PREFIX)).length;
}

describe('company docs', () => {
  test('the constant declares five facts and always sets the trade name', () => {
    expect(Object.keys(COMPANY)).toHaveLength(COMPANY_FACT_COUNT);
    expect(COMPANY.tradeName).not.toBe(COMPANY_FACT_UNSET);
  });

  test('every fact equals the value published on the official site and none is the unset sentinel', () => {
    expect(COMPANY).toEqual(PUBLISHED_COMPANY_FACTS);
    expect(Object.values(COMPANY)).not.toContain(COMPANY_FACT_UNSET);
  });

  test.each(COMPANY_SNIPPETS)('%s shows every fact', (snippet) => {
    const text = readRepositoryFile(snippet);
    const missing = companyFacts.filter((fact) => !text.includes(fact));
    expect(missing).toEqual([]);
  });

  test.each(COMPANY_SNIPPETS)('%s shows exactly the facts that are set, one row each', (snippet) => {
    expect(tableRowCount(snippet)).toBe(TABLE_HEADER_ROW_COUNT + companyFacts.length);
  });

  test.each(COMPANY_SNIPPETS)('%s never shows the unset sentinel', (snippet) => {
    expect(readRepositoryFile(snippet)).not.toContain(COMPANY_FACT_UNSET);
  });

  test('no docs page renders the unset sentinel', () => {
    const offenders = documentFiles('').filter((page) => readRepositoryFile(`${DOCS_ROOT}/${page}`).includes(COMPANY_FACT_UNSET));
    expect(offenders).toEqual([]);
  });

  test.each(LICENSE_PAGES)('%s renders the company snippet', (page) => {
    expect(readRepositoryFile(page)).toContain('company.mdx');
  });

  test('the footer carries one neutral line linking the license page', () => {
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

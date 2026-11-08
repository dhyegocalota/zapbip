import { readFileSync } from 'node:fs';
import { DocsLanguage, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { LEGACY_INSTALL_PAGE_ORDER, LEGACY_MATRIX_ORDER, LEGACY_NAVIGATION_ORDER } from '../src/legacy-order';
import {
  GOLDEN_FOLDER,
  GOLDEN_STANDBY_AGENT,
  canonicalInstallPageOf,
  installPageOf,
  matrixRowsByAgentOf,
  navigationEntriesOf,
  orderOf,
  productHeadingsOf,
  type GoldenOrder,
  type MatrixRows,
  type NavigationEntries,
} from './golden-sources';

const STANDBY_CASES = [
  { name: 'without a standby agent', standbyAgent: null, suffix: '' },
  { name: 'with a standby agent', standbyAgent: GOLDEN_STANDBY_AGENT, suffix: '.standby' },
];
const REAL_AGENT_COUNT = 11;
const INSTALL_AGENT_COUNT = 10;

function goldenText(name: string): string {
  return readFileSync(`${GOLDEN_FOLDER}${name}`, 'utf8');
}

function goldenJson<Shape>(name: string): Shape {
  return JSON.parse(goldenText(name)) as Shape;
}

describe('the install page golden', () => {
  describe.each(Object.values(OwnerLocale))('in %s', (locale) => {
    test.each(STANDBY_CASES)('$name', ({ standbyAgent, suffix }) => {
      const page = installPageOf({ locale, standbyAgent });
      expect(`${canonicalInstallPageOf({ page, locale })}\n`).toBe(goldenText(`install-page.${locale}${suffix}.md`));
      expect(productHeadingsOf({ page })).toHaveLength(INSTALL_AGENT_COUNT);
    });
  });
});

describe('the matrix golden', () => {
  const golden = goldenJson<Record<DocsLanguage, MatrixRows>>('matrix.json');

  describe.each(Object.values(DocsLanguage))('in %s', (language) => {
    const rows = matrixRowsByAgentOf({ language });

    test('has the rows of the golden and no other', () => {
      expect(Object.keys(rows).sort()).toEqual(Object.keys(golden[language]).sort());
      expect(Object.keys(rows)).toHaveLength(REAL_AGENT_COUNT);
    });

    test.each(Object.keys(golden[DocsLanguage.English]))('the row of %s', (agent) => {
      expect(rows[agent]).toBe(golden[language][agent]);
    });
  });
});

describe('the navigation golden', () => {
  const golden = goldenJson<Record<DocsLanguage, NavigationEntries>>('navigation.json');

  describe.each(Object.values(DocsLanguage))('in %s', (language) => {
    const entries = navigationEntriesOf({ language });

    test('has the entries of the golden and no other', () => {
      expect(Object.keys(entries).sort()).toEqual(Object.keys(golden[language]).sort());
    });

    test.each(Object.keys(golden[DocsLanguage.English]))('the entry of %s', (agent) => {
      expect(entries[agent]).toBe(golden[language][agent]);
    });
  });
});

describe('the order golden', () => {
  const golden = goldenJson<GoldenOrder>('order.json');

  test('the install page, the matrix and the navigation are listed in the golden order', () => {
    expect(orderOf()).toEqual(golden);
  });

  test('the golden order is the legacy order', () => {
    expect(golden.installPage).toEqual(LEGACY_INSTALL_PAGE_ORDER);
    Object.values(DocsLanguage).forEach((language) => {
      expect(golden.matrix[language]).toEqual(LEGACY_MATRIX_ORDER);
      expect(golden.navigation[language]).toEqual(LEGACY_NAVIGATION_ORDER);
    });
  });
});

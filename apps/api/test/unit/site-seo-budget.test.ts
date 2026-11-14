import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { LegalDocument } from '../../src/site/legal-links';
import { legalTextOf } from '../../src/site/legal-copy';
import { pageMetaOf } from '../../src/site/page-meta';
import { SiteCopyKey } from '../../src/site/site-copy';
import { copyOf } from '../../src/site/site-copy-text';
import { pageModelFor } from '../support/page-model';

const FULL_WIDTH_PATTERN = /[ᄀ-ᇿ⺀-꓏가-힯豈-﫿︰-﹏＀-￯]/;
const FULL_WIDTH_WEIGHT = 2;
const TITLE_MAXIMUM = 70;
const DESCRIPTION_MINIMUM = 50;
const DESCRIPTION_MAXIMUM = 160;
const PAGE_DOCUMENTS: (LegalDocument | null)[] = [null, ...Object.values(LegalDocument)];

function weightedLengthOf(input: { text: string }): number {
  return [...input.text].reduce((total, character) => total + (FULL_WIDTH_PATTERN.test(character) ? FULL_WIDTH_WEIGHT : 1), 0);
}

function metaOf(input: { locale: OwnerLocale; document: LegalDocument | null }) {
  const { locale, document } = input;
  const title = document === null ? copyOf({ locale })(SiteCopyKey.MetaTitle) : legalTextOf({ document, locale }).title;
  return pageMetaOf({ model: pageModelFor({ locale, legalDocument: document }), title });
}

describe.each(Object.values(OwnerLocale))('page meta in %s', (locale) => {
  it.each(PAGE_DOCUMENTS)('keeps the title of %s inside the budget', (document) => {
    expect(weightedLengthOf({ text: metaOf({ locale, document }).title })).toBeLessThanOrEqual(TITLE_MAXIMUM);
  });

  it.each(PAGE_DOCUMENTS)('keeps the description of %s inside the budget', (document) => {
    const length = weightedLengthOf({ text: metaOf({ locale, document }).description });
    expect(length).toBeGreaterThanOrEqual(DESCRIPTION_MINIMUM);
    expect(length).toBeLessThanOrEqual(DESCRIPTION_MAXIMUM);
  });

  it('gives a legal page its own Open Graph title', () => {
    Object.values(LegalDocument).forEach((document) => {
      const meta = metaOf({ locale, document });
      expect(meta.openGraphTitle).toBe(legalTextOf({ document, locale }).title);
    });
  });
});

describe('page meta across pages', () => {
  const metas = Object.values(OwnerLocale).flatMap((locale) => PAGE_DOCUMENTS.map((document) => metaOf({ locale, document })));

  it('never repeats a title', () => {
    expect(new Set(metas.map((meta) => meta.title)).size).toBe(metas.length);
  });

  it('never repeats a description', () => {
    expect(new Set(metas.map((meta) => meta.description)).size).toBe(metas.length);
  });
});

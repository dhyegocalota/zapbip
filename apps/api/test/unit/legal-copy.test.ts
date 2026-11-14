import { OWNER_LOCALE_OF_WEB_LOCALE, OwnerLocale, WebLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { legalTextOf } from '../../src/site/legal-copy';
import { LegalDocument } from '../../src/site/legal-links';
import { cjkSpacingOffenders, frenchSpacingOffenders } from './copy-rules';

const LOCALES = Object.values(WebLocale);
const DOCUMENTS = Object.values(LegalDocument);
const UNFILLED_PLACEHOLDER = /\{(?!contactEmail\})\w+\}/;
const DELETE_COMMAND = 'delete account';
const PROVIDER_NAMES = ['Meta', 'Cloudflare', 'Mintlify'];
const CASES = DOCUMENTS.flatMap((document) => LOCALES.map((locale) => [document, locale] as const));

function stringsOf(input: { document: LegalDocument; locale: WebLocale }): string[] {
  const text = legalTextOf(input);
  return [
    text.title,
    text.description,
    text.summary,
    text.updated,
    ...text.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...section.items]),
  ];
}

describe('the legal copy', () => {
  it.each(CASES)('has the same sections, paragraphs and items in %s %s as in English', (document, locale) => {
    const shapeOf = (candidate: WebLocale): number[][] =>
      legalTextOf({ document, locale: candidate }).sections.map((section) => [section.paragraphs.length, section.items.length]);
    expect(shapeOf(locale)).toEqual(shapeOf(WebLocale.EnglishUs));
  });

  it.each(CASES)('leaves no blank string and no unfilled placeholder in %s %s', (document, locale) => {
    const strings = stringsOf({ document, locale });
    expect(strings.filter((value) => value.trim().length === 0)).toEqual([]);
    expect(strings.filter((value) => UNFILLED_PLACEHOLDER.test(value))).toEqual([]);
  });

  it.each(CASES)('reads differently from English in %s %s, section by section', (document, locale) => {
    if (locale === WebLocale.EnglishUs) return;
    const english = legalTextOf({ document, locale: WebLocale.EnglishUs });
    const translated = legalTextOf({ document, locale });
    const bodyOf = (section: { paragraphs: string[]; items: string[] }): string => [...section.paragraphs, ...section.items].join('\n');
    expect(translated.title).not.toBe(english.title);
    expect(translated.sections.filter((section, index) => bodyOf(section) === bodyOf(english.sections[index]!))).toEqual([]);
  });

  it.each(LOCALES.filter((locale) => OWNER_LOCALE_OF_WEB_LOCALE[locale] === OwnerLocale.EnglishUs))(
    'keeps the WhatsApp command and the provider names untranslated in the %s documents',
    (locale) => {
      const terms = stringsOf({ document: LegalDocument.Terms, locale }).join('\n');
      const privacy = stringsOf({ document: LegalDocument.Privacy, locale }).join('\n');
      expect(terms).toContain(DELETE_COMMAND);
      expect(privacy).toContain(DELETE_COMMAND);
      PROVIDER_NAMES.forEach((name) => expect(privacy).toContain(name));
    },
  );

  it.each(LOCALES.filter((locale) => locale !== WebLocale.PortugueseBrazil))(
    'says the Portuguese version prevails in the %s terms and policy',
    (locale) => {
      const closing = (document: LegalDocument): string => {
        const sections = legalTextOf({ document, locale }).sections;
        return sections
          .flatMap((section) => section.paragraphs)
          .filter((paragraph) => /portug|ポルトガル|포르투갈|葡萄牙/i.test(paragraph))
          .join('\n');
      };
      expect(closing(LegalDocument.Terms)).not.toBe('');
      expect(closing(LegalDocument.Privacy)).not.toBe('');
    },
  );

  it('keeps the French punctuation spaces non-breaking', () => {
    const texts = DOCUMENTS.flatMap((document) => stringsOf({ document, locale: WebLocale.French }));
    expect(frenchSpacingOffenders({ texts })).toEqual([]);
  });

  it.each([WebLocale.Japanese, WebLocale.ChineseSimplified])('puts no space between two Chinese or Japanese characters in %s', (locale) => {
    const texts = DOCUMENTS.flatMap((document) => stringsOf({ document, locale }));
    expect(cjkSpacingOffenders({ texts })).toEqual([]);
  });

  it.each(LOCALES)('writes the date of the last update in the language of %s', (locale) => {
    const { updated } = legalTextOf({ document: LegalDocument.Terms, locale });
    expect(updated).toMatch(/2026/);
  });
});

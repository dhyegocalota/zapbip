import { COMMAND_WORDS } from '@zapbip/core';
import { CommandKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { legalTextOf } from '../../src/site/legal-copy';
import { LegalDocument } from '../../src/site/legal-links';
import { CONTACT_PLACEHOLDER } from '../../src/site/plain-contact-text';
import { cjkSpacingOffenders, frenchSpacingOffenders } from './copy-rules';

const LOCALES = Object.values(OwnerLocale);
const DOCUMENTS = Object.values(LegalDocument);
const UNFILLED_PLACEHOLDER = /\{(?!contactEmail\})\w+\}/;
const SUBSCRIPTION_NAME_PATTERN = /zapbip.Cloud/;
function deleteCommandOf(input: { locale: OwnerLocale }): string {
  return COMMAND_WORDS.find((entry) => entry.kind === CommandKind.RequestDeletion && entry.locale === input.locale)!.words;
}

const PROVIDER_NAMES = ['Meta', 'Cloudflare', 'Mintlify', 'Resend'];
const CASES = DOCUMENTS.flatMap((document) => LOCALES.map((locale) => [document, locale] as const));

function stringsOf(input: { document: LegalDocument; locale: OwnerLocale }): string[] {
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
    const shapeOf = (candidate: OwnerLocale): number[][] =>
      legalTextOf({ document, locale: candidate }).sections.map((section) => [section.paragraphs.length, section.items.length]);
    expect(shapeOf(locale)).toEqual(shapeOf(OwnerLocale.EnglishUs));
  });

  it.each(CASES)('leaves no blank string and no unfilled placeholder in %s %s', (document, locale) => {
    const strings = stringsOf({ document, locale });
    expect(strings.filter((value) => value.trim().length === 0)).toEqual([]);
    expect(strings.filter((value) => UNFILLED_PLACEHOLDER.test(value))).toEqual([]);
  });

  it.each(CASES)('reads differently from English in %s %s, section by section', (document, locale) => {
    if (locale === OwnerLocale.EnglishUs) return;
    const english = legalTextOf({ document, locale: OwnerLocale.EnglishUs });
    const translated = legalTextOf({ document, locale });
    const bodyOf = (section: { paragraphs: string[]; items: string[] }): string => [...section.paragraphs, ...section.items].join('\n');
    expect(translated.title).not.toBe(english.title);
    expect(translated.sections.filter((section, index) => bodyOf(section) === bodyOf(english.sections[index]!))).toEqual([]);
  });

  it.each(LOCALES)('names the delete command of its own language and keeps the provider names in the %s documents', (locale) => {
    const terms = stringsOf({ document: LegalDocument.Terms, locale }).join('\n');
    const privacy = stringsOf({ document: LegalDocument.Privacy, locale }).join('\n');
    expect(terms).toContain(deleteCommandOf({ locale }));
    expect(privacy).toContain(deleteCommandOf({ locale }));
    PROVIDER_NAMES.forEach((name) => expect(privacy).toContain(name));
  });

  it.each(LOCALES)('[row 439] says in %s that deleting does not cancel the subscription, in the terms and the policy', (locale) => {
    const noticeOf = (document: LegalDocument): string | undefined =>
      stringsOf({ document, locale }).find((value) => value.includes(CONTACT_PLACEHOLDER) && SUBSCRIPTION_NAME_PATTERN.test(value));
    expect(noticeOf(LegalDocument.Terms)).toBeDefined();
    expect(noticeOf(LegalDocument.Privacy)).toBeDefined();
  });

  it.each(LOCALES.filter((locale) => locale !== OwnerLocale.PortugueseBrazil))(
    'says the Portuguese version prevails in the %s terms and policy',
    (locale) => {
      const closing = (document: LegalDocument): string => {
        const sections = legalTextOf({ document, locale }).sections;
        return sections
          .flatMap((section) => section.paragraphs)
          .filter((paragraph) => /portug|ポルトガル|포르투갈|葡萄牙|البرتغالية|पुर्तगाली/i.test(paragraph))
          .join('\n');
      };
      expect(closing(LegalDocument.Terms)).not.toBe('');
      expect(closing(LegalDocument.Privacy)).not.toBe('');
    },
  );

  it('keeps the French punctuation spaces non-breaking', () => {
    const texts = DOCUMENTS.flatMap((document) => stringsOf({ document, locale: OwnerLocale.French }));
    expect(frenchSpacingOffenders({ texts })).toEqual([]);
  });

  it.each([OwnerLocale.Japanese, OwnerLocale.ChineseSimplified])(
    'puts no space between two Chinese or Japanese characters in %s',
    (locale) => {
      const texts = DOCUMENTS.flatMap((document) => stringsOf({ document, locale }));
      expect(cjkSpacingOffenders({ texts })).toEqual([]);
    },
  );

  it.each(LOCALES)('writes the date of the last update in the language of %s', (locale) => {
    const { updated } = legalTextOf({ document: LegalDocument.Terms, locale });
    expect(updated).toMatch(/2026/);
  });
});

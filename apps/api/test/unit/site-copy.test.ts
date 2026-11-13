import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WebLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { renderSiteCopy, SITE_COPY, SiteCopyKey } from '../../src/site/site-copy';
import { cjkSpacingOffenders, emptyEntries, frenchSpacingOffenders, placeholderMismatches, untranslatedEntries } from './copy-rules';

const SITE_ROOT = join(import.meta.dirname, '../../src/site');
const LOCALES = Object.values(WebLocale);
const SHARED_WITH_ENGLISH = [
  `${WebLocale.Spanish}:${SiteCopyKey.NoticeLabelError}`,
  `${WebLocale.Spanish}:${SiteCopyKey.FooterLegalLabel}`,
  `${WebLocale.German}:${SiteCopyKey.FaqEyebrow}`,
  `${WebLocale.French}:${SiteCopyKey.NavigationDocs}`,
  `${WebLocale.French}:${SiteCopyKey.NoticeLabelInfo}`,
  `${WebLocale.French}:${SiteCopyKey.FaqEyebrow}`,
  `${WebLocale.French}:${SiteCopyKey.FaqTitle}`,
];
const KEYS = Object.values(SiteCopyKey);
const TEXT_CHILD_PATTERN = />\s*[A-Za-z0-9][^<>{}();=]*</;
const STRING_CHILD_PATTERN = />\s*\{\s*['"`]/;
const IDENTICAL_IN_EVERY_LANGUAGE = [SiteCopyKey.BrandName, SiteCopyKey.CapabilityListChatRows, SiteCopyKey.PricingProName];

function viewSources(input: { directory: string }): { path: string; source: string }[] {
  return readdirSync(input.directory).flatMap((name) => {
    const path = join(input.directory, name);
    if (statSync(path).isDirectory()) return viewSources({ directory: path });
    return name.endsWith('.tsx') ? [{ path, source: readFileSync(path, 'utf8') }] : [];
  });
}

describe('site copy', () => {
  it.each(LOCALES)('%s has every key, none empty', (locale) => {
    expect(KEYS.filter((key) => typeof SITE_COPY[locale][key] !== 'string' || SITE_COPY[locale][key].length === 0)).toEqual([]);
  });

  it('uses the same placeholders in every language', () => {
    expect(placeholderMismatches({ copies: SITE_COPY, keys: KEYS })).toEqual([]);
  });

  it('words every sentence differently from English in every other language, except proper names', () => {
    expect(
      untranslatedEntries({ copies: SITE_COPY, keys: KEYS, allowed: [...IDENTICAL_IN_EVERY_LANGUAGE, ...SHARED_WITH_ENGLISH] }),
    ).toEqual([]);
  });

  it('gives every language a copy of its own for every key, none blank', () => {
    expect(emptyEntries({ copies: SITE_COPY, keys: KEYS })).toEqual([]);
  });

  it('keeps the French punctuation spaces non-breaking', () => {
    expect(frenchSpacingOffenders({ texts: KEYS.map((key) => SITE_COPY[WebLocale.French][key]) })).toEqual([]);
  });

  it.each([WebLocale.Japanese, WebLocale.ChineseSimplified])('puts no space between two Chinese or Japanese characters in %s', (locale) => {
    expect(cjkSpacingOffenders({ texts: KEYS.map((key) => SITE_COPY[locale][key]) })).toEqual([]);
  });

  it.each([WebLocale.Spanish, WebLocale.German, WebLocale.French, WebLocale.Japanese, WebLocale.Korean, WebLocale.ChineseSimplified])(
    'names no fixed official number and offers no own number in %s',
    (locale) => {
      expect(SITE_COPY[locale][SiteCopyKey.FaqOwnNumberAnswer]).toContain('zapbip');
      expect(KEYS.filter((key) => /official number|número oficial/i.test(SITE_COPY[locale][key]))).toEqual([]);
    },
  );

  it('renders placeholders', () => {
    expect(renderSiteCopy({ key: SiteCopyKey.ThanksInviteCount, locale: WebLocale.EnglishUs, values: { count: '2', cap: '5' } })).toBe(
      '2 of 5 friends invited',
    );
  });

  it('keeps string literals out of JSX children', () => {
    const offenders = viewSources({ directory: SITE_ROOT })
      .filter(({ source }) => TEXT_CHILD_PATTERN.test(source) || STRING_CHILD_PATTERN.test(source))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it.each(LOCALES)('promises nothing the standby wake cannot keep in the routing story in %s', (locale) => {
    expect(SITE_COPY[locale][SiteCopyKey.WhyRoutingBody]).not.toMatch(/never to another|nunca para outro/);
  });
});

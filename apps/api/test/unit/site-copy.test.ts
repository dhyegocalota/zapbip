import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { renderSiteCopy, SITE_COPY, SiteCopyKey } from '../../src/site/site-copy';

const SITE_ROOT = join(import.meta.dirname, '../../src/site');
const LOCALES = Object.values(OwnerLocale);
const KEYS = Object.values(SiteCopyKey);
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
const TEXT_CHILD_PATTERN = />\s*[A-Za-z0-9][^<>{}();=]*</;
const STRING_CHILD_PATTERN = />\s*\{\s*['"`]/;
const IDENTICAL_IN_BOTH_LANGUAGES = [
  SiteCopyKey.BrandName,
  SiteCopyKey.LocalePortuguese,
  SiteCopyKey.LocalePortugueseShort,
  SiteCopyKey.LocaleEnglish,
  SiteCopyKey.LocaleEnglishShort,
  SiteCopyKey.CapabilityListChatRows,
  SiteCopyKey.PricingProName,
];

function viewSources(input: { directory: string }): { path: string; source: string }[] {
  return readdirSync(input.directory).flatMap((name) => {
    const path = join(input.directory, name);
    if (statSync(path).isDirectory()) return viewSources({ directory: path });
    return name.endsWith('.tsx') ? [{ path, source: readFileSync(path, 'utf8') }] : [];
  });
}

function placeholdersOf(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]!).sort();
}

describe('site copy', () => {
  it.each(LOCALES)('%s has every key, none empty', (locale) => {
    expect(KEYS.filter((key) => typeof SITE_COPY[locale][key] !== 'string' || SITE_COPY[locale][key].length === 0)).toEqual([]);
  });

  it('uses the same placeholders in both locales', () => {
    const mismatched = KEYS.filter(
      (key) =>
        placeholdersOf(SITE_COPY[OwnerLocale.EnglishUs][key]).join() !==
        placeholdersOf(SITE_COPY[OwnerLocale.PortugueseBrazil][key]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('words every sentence differently in the two languages, except proper names', () => {
    const identical = KEYS.filter(
      (key) =>
        SITE_COPY[OwnerLocale.EnglishUs][key] === SITE_COPY[OwnerLocale.PortugueseBrazil][key] &&
        !IDENTICAL_IN_BOTH_LANGUAGES.includes(key),
    );
    expect(identical).toEqual([]);
  });

  it('renders placeholders', () => {
    expect(renderSiteCopy({ key: SiteCopyKey.ThanksInviteCount, locale: OwnerLocale.EnglishUs, values: { count: '2', cap: '5' } })).toBe(
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

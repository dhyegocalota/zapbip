import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BACKOFFICE_COPY, BackofficeCopyKey, renderBackofficeCopy } from '../../src/backoffice/backoffice-copy';
import { cjkSpacingOffenders, emptyEntries, frenchSpacingOffenders, placeholderMismatches, untranslatedEntries } from './copy-rules';

const BACKOFFICE_ROOT = join(import.meta.dirname, '../../src/backoffice');
const LOCALES = Object.values(OwnerLocale);
const REQUIRED_KEYS = [
  'SignInTitle',
  'SignInFailed',
  'HomeTitle',
  'AuditTitle',
  'Error404Title',
  'Error503Body',
  'NoticeLabelError',
  'NavigationNumbers',
  'StateActive',
  'NumbersConnect',
  'MetricsTitle',
];
const POLISH_KEYS = [
  'SignInEyebrow',
  'SignInLead',
  'HomeMetricsBody',
  'HomeAuditBody',
  'HomeNumbersUnit',
  'SparklineNumbersMetric',
  'SparklineMessagesMetric',
  'SparklineAuditMetric',
  'SparklineSummary',
  'SparklineEmpty',
  'MetricsDeltaUp',
  'MetricsDeltaDown',
  'MetricsDeltaFlat',
  'MetricsKpiWakes',
  'MetricsKpiMessagesIn',
  'MetricsKpiMessagesOut',
];
const SAME_IN_EVERY_LANGUAGE = [
  BackofficeCopyKey.EnvironmentStaging,
  BackofficeCopyKey.NumberWabaId,
  BackofficeCopyKey.WaitlistColumnPosition,
  BackofficeCopyKey.BrandName,
  BackofficeCopyKey.FooterLine,
  BackofficeCopyKey.AuditOutcomeSucceeded,
  BackofficeCopyKey.MetricsPercentValue,
];
const SHARED_WITH_ENGLISH = [
  [OwnerLocale.PortugueseBrazil, BackofficeCopyKey.AccessInviteColumnLink],
  [OwnerLocale.PortugueseBrazil, BackofficeCopyKey.MetricsAccessColumnTotal],
  [OwnerLocale.Spanish, BackofficeCopyKey.NoticeLabelError],
  [OwnerLocale.Spanish, BackofficeCopyKey.MetricsAccessColumnTotal],
  [OwnerLocale.German, BackofficeCopyKey.NavigationAudit],
  [OwnerLocale.German, BackofficeCopyKey.MetricsFreshnessLive],
  [OwnerLocale.German, BackofficeCopyKey.AccessInviteColumnLink],
  [OwnerLocale.French, BackofficeCopyKey.NavigationAudit],
  [OwnerLocale.French, BackofficeCopyKey.SparklineMessagesMetric],
  [OwnerLocale.French, BackofficeCopyKey.MetricsAgentsTitle],
  [OwnerLocale.French, BackofficeCopyKey.MetricsMessagesTitle],
  [OwnerLocale.French, BackofficeCopyKey.MetricsTemplatesQuestion],
  [OwnerLocale.French, BackofficeCopyKey.AuditColumnAction],
  [OwnerLocale.French, BackofficeCopyKey.NoticeLabelInfo],
  [OwnerLocale.French, BackofficeCopyKey.MetricsAccessColumnTotal],
  [OwnerLocale.German, BackofficeCopyKey.SourceAgent],
  [OwnerLocale.German, BackofficeCopyKey.AgentKeysColumnStatus],
  [OwnerLocale.French, BackofficeCopyKey.SourceAgent],
  [OwnerLocale.French, BackofficeCopyKey.AgentKeysColumnActions],
  [OwnerLocale.French, BackofficeCopyKey.AgentKeysStatusActive],
].map(([locale, key]) => `${locale}:${key}`);
const SIGN_IN_KEYS = ['SignInLead', 'SignInEmailLabel', 'SignInPasswordLabel', 'SignInSubmit', 'SignInCodeLead', 'SignInCodeSubmit'];
const REMOVED_KEYS = ['SignInKeyLabel', 'SignInKeyHelp'];
const TEXT_CHILD_PATTERN = />\s*[A-Za-z0-9][^<>{}();=]*</;
const STRING_CHILD_PATTERN = />\s*\{\s*['"`]/;

function viewSources(input: { directory: string }): { path: string; source: string }[] {
  return readdirSync(input.directory).flatMap((name) => {
    const path = join(input.directory, name);
    if (statSync(path).isDirectory()) return viewSources({ directory: path });
    return name.endsWith('.tsx') ? [{ path, source: readFileSync(path, 'utf8') }] : [];
  });
}

describe('backoffice copy', () => {
  it.each(LOCALES)('%s has every key, none empty', (locale) => {
    const entries = Object.values(BackofficeCopyKey).map((key) => BACKOFFICE_COPY[locale][key]);
    expect(entries.every((text) => typeof text === 'string' && text.length > 0)).toBe(true);
  });

  it.each(REQUIRED_KEYS)('names the key %s', (name) => {
    expect(Object.keys(BackofficeCopyKey)).toContain(name);
  });

  it('gives every language a copy of its own for every key, none blank', () => {
    expect(emptyEntries({ copies: BACKOFFICE_COPY, keys: Object.values(BackofficeCopyKey) })).toEqual([]);
  });

  it('uses the same placeholders in every language', () => {
    expect(placeholderMismatches({ copies: BACKOFFICE_COPY, keys: Object.values(BackofficeCopyKey) })).toEqual([]);
  });

  it('words every text differently from English in every other language, except names, units and symbols', () => {
    expect(
      untranslatedEntries({
        copies: BACKOFFICE_COPY,
        keys: Object.values(BackofficeCopyKey),
        allowed: [...SAME_IN_EVERY_LANGUAGE, ...SHARED_WITH_ENGLISH],
      }),
    ).toEqual([]);
  });

  it('keeps the French punctuation spaces non-breaking', () => {
    const texts = Object.values(BackofficeCopyKey).map((key) => BACKOFFICE_COPY[OwnerLocale.French][key]);
    expect(frenchSpacingOffenders({ texts })).toEqual([]);
  });

  it.each([OwnerLocale.Japanese, OwnerLocale.ChineseSimplified])(
    'puts no space between two Chinese or Japanese characters in %s',
    (locale) => {
      const texts = Object.values(BackofficeCopyKey).map((key) => BACKOFFICE_COPY[locale][key]);
      expect(cjkSpacingOffenders({ texts })).toEqual([]);
    },
  );

  it('renders placeholders', () => {
    expect(renderBackofficeCopy({ key: BackofficeCopyKey.NumbersView, locale: OwnerLocale.EnglishUs, values: { label: 'Brazil' } })).toBe(
      'View Brazil',
    );
  });

  it.each(POLISH_KEYS)('carries %s in both locales with the same placeholders', (name) => {
    const key = BackofficeCopyKey[name as keyof typeof BackofficeCopyKey];
    const portuguese = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil][key];
    const english = BACKOFFICE_COPY[OwnerLocale.EnglishUs][key];
    expect(portuguese).toBeTypeOf('string');
    expect(english).toBeTypeOf('string');
    expect(portuguese).not.toBe(english);
    expect(placeholderMismatches({ copies: BACKOFFICE_COPY, keys: [key] })).toEqual([]);
  });

  it.each(SIGN_IN_KEYS)('carries the sign-in key %s in both locales, worded differently', (name) => {
    expect(Object.keys(BackofficeCopyKey)).toContain(name);
    const key = BackofficeCopyKey[name as keyof typeof BackofficeCopyKey];
    expect(untranslatedEntries({ copies: BACKOFFICE_COPY, keys: [key], allowed: [] })).toEqual([]);
  });

  it.each(REMOVED_KEYS)('no longer has the key %s', (name) => {
    expect(Object.keys(BackofficeCopyKey)).not.toContain(name);
  });

  it('keeps string literals out of JSX children', () => {
    const offenders = viewSources({ directory: BACKOFFICE_ROOT })
      .filter(({ source }) => TEXT_CHILD_PATTERN.test(source) || STRING_CHILD_PATTERN.test(source))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});

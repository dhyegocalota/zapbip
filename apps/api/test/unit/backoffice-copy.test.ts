import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BACKOFFICE_COPY, BackofficeCopyKey, renderBackofficeCopy } from '../../src/backoffice/backoffice-copy';

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
  'RegisterSubmit',
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
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
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

  it('renders placeholders', () => {
    expect(renderBackofficeCopy({ key: BackofficeCopyKey.NumbersView, locale: OwnerLocale.EnglishUs, values: { label: 'Brazil' } })).toBe(
      'View Brazil',
    );
  });

  it.each(POLISH_KEYS)('carries %s in both locales with the same placeholders', (name) => {
    const key = BackofficeCopyKey[name as keyof typeof BackofficeCopyKey];
    const [portuguese, english] = LOCALES.map((locale) => BACKOFFICE_COPY[locale][key]);
    expect(portuguese).toBeTypeOf('string');
    expect(english).toBeTypeOf('string');
    expect(portuguese).not.toBe(english);
    const placeholdersOf = (text: string): string[] => [...text.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]!).sort();
    expect(placeholdersOf(portuguese!)).toEqual(placeholdersOf(english!));
  });

  it('keeps string literals out of JSX children', () => {
    const offenders = viewSources({ directory: BACKOFFICE_ROOT })
      .filter(({ source }) => TEXT_CHILD_PATTERN.test(source) || STRING_CHILD_PATTERN.test(source))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});

import { DAY_MS, OwnerLocale } from '@zapbip/types';

export enum AccessSource {
  Form = 'form',
  Agent = 'agent',
  All = 'all',
}

export type AccessFilter = { from: string | null; to: string | null; locale: OwnerLocale | null; source: AccessSource };

export const NO_ACCESS_FILTER: AccessFilter = { from: null, to: null, locale: null, source: AccessSource.Form };

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEB_LOCALES: string[] = Object.values(OwnerLocale);
const ACCESS_SOURCES: string[] = Object.values(AccessSource);

function dayOf(input: { value: string | null }): string | null {
  const { value } = input;
  if (value === null || !DAY_PATTERN.test(value)) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function localeOf(input: { value: string | null }): OwnerLocale | null {
  const { value } = input;
  if (value === null || !WEB_LOCALES.includes(value)) return null;
  return value as OwnerLocale;
}

function sourceOf(input: { value: string | null }): AccessSource {
  const { value } = input;
  if (value === null || !ACCESS_SOURCES.includes(value)) return AccessSource.Form;
  return value as AccessSource;
}

export function parseAccessFilter(input: {
  from: string | null;
  to: string | null;
  locale: string | null;
  source: string | null;
}): AccessFilter {
  return {
    from: dayOf({ value: input.from }),
    to: dayOf({ value: input.to }),
    locale: localeOf({ value: input.locale }),
    source: sourceOf({ value: input.source }),
  };
}

export function filterSource(input: { filter: AccessFilter }): AccessSource | null {
  const { source } = input.filter;
  return source === AccessSource.All ? null : source;
}

export function filterSince(input: { filter: AccessFilter }): number | null {
  const { from } = input.filter;
  return from === null ? null : Date.parse(from);
}

export function filterBefore(input: { filter: AccessFilter }): number | null {
  const { to } = input.filter;
  return to === null ? null : Date.parse(to) + DAY_MS;
}

import { DAY_MS, OwnerLocale } from '@zapbip/types';

export type AccessFilter = { from: string | null; to: string | null; locale: OwnerLocale | null };

export const NO_ACCESS_FILTER: AccessFilter = { from: null, to: null, locale: null };

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OWNER_LOCALES: string[] = Object.values(OwnerLocale);

function dayOf(input: { value: string | null }): string | null {
  const { value } = input;
  if (value === null || !DAY_PATTERN.test(value)) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function localeOf(input: { value: string | null }): OwnerLocale | null {
  const { value } = input;
  if (value === null || !OWNER_LOCALES.includes(value)) return null;
  return value as OwnerLocale;
}

export function parseAccessFilter(input: { from: string | null; to: string | null; locale: string | null }): AccessFilter {
  return { from: dayOf({ value: input.from }), to: dayOf({ value: input.to }), locale: localeOf({ value: input.locale }) };
}

export function filterSince(input: { filter: AccessFilter }): number | null {
  const { from } = input.filter;
  return from === null ? null : Date.parse(from);
}

export function filterBefore(input: { filter: AccessFilter }): number | null {
  const { to } = input.filter;
  return to === null ? null : Date.parse(to) + DAY_MS;
}

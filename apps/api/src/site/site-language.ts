import type { OwnerLocale } from '@zapbip/types';

export function localePathOf(input: { locale: OwnerLocale }): string {
  throw new Error('localePathOf is not implemented');
}

export function localeOfPath(input: { pathname: string }): OwnerLocale | null {
  throw new Error('localeOfPath is not implemented');
}

export function localeOfLanguageValue(input: { value: string | undefined }): OwnerLocale | null {
  throw new Error('localeOfLanguageValue is not implemented');
}

export function preferredLocaleOf(input: { cookieValue: string | undefined; acceptLanguage: string | undefined }): OwnerLocale {
  throw new Error('preferredLocaleOf is not implemented');
}

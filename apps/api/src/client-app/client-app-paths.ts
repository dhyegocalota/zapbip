import { CLIENT_APP_LOCALE_PATH_PREFIXES, OwnerLocale } from '@zapbip/types';

export const PREFIXED_LOCALES = Object.values(OwnerLocale).filter((locale) => CLIENT_APP_LOCALE_PATH_PREFIXES[locale] !== '');

export enum ClientAppPath {
  Home = '/',
  SignIn = '/sign-in',
  SignOut = '/sign-out',
  Locale = '/locale',
  Theme = '/theme',
  Agents = '/agents',
  RevokeAgent = '/agents/revoke',
  Stylesheet = '/app.css',
  Favicon = '/favicon.svg',
}

export function localeOfPath(input: { path: string }): OwnerLocale {
  const { path } = input;
  const prefixed = PREFIXED_LOCALES.find((locale) => {
    const prefix = CLIENT_APP_LOCALE_PATH_PREFIXES[locale];
    return path === prefix || path.startsWith(`${prefix}/`);
  });
  return prefixed === undefined ? OwnerLocale.EnglishUs : prefixed;
}

export function pathWithLocale(input: { locale: OwnerLocale; path: string }): string {
  const prefix = CLIENT_APP_LOCALE_PATH_PREFIXES[input.locale];
  const isRootWithPrefix = input.path === ClientAppPath.Home && prefix !== '';
  if (isRootWithPrefix) return prefix;
  return `${prefix}${input.path}`;
}

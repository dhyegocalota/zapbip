import { WEB_LOCALE_PATH_PREFIXES, WebLocale } from '@zapbip/types';

export const PREFIXED_LOCALES = Object.values(WebLocale).filter((locale) => WEB_LOCALE_PATH_PREFIXES[locale] !== '');

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

export function localeOfPath(input: { path: string }): WebLocale {
  const { path } = input;
  const prefixed = PREFIXED_LOCALES.find((locale) => {
    const prefix = WEB_LOCALE_PATH_PREFIXES[locale];
    return path === prefix || path.startsWith(`${prefix}/`);
  });
  return prefixed === undefined ? WebLocale.EnglishUs : prefixed;
}

export function pathWithLocale(input: { locale: WebLocale; path: string }): string {
  const prefix = WEB_LOCALE_PATH_PREFIXES[input.locale];
  const isRootWithPrefix = input.path === ClientAppPath.Home && prefix !== '';
  if (isRootWithPrefix) return prefix;
  return `${prefix}${input.path}`;
}

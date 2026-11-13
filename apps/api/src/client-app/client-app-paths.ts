import { CLIENT_APP_LOCALE_PATH_PREFIXES, CLIENT_APP_PORTUGUESE_PATH_PREFIX, OwnerLocale } from '@zapbip/types';

export enum ClientAppPath {
  Home = '/',
  SignIn = '/sign-in',
  SignOut = '/sign-out',
  Agents = '/agents',
  RevokeAgent = '/agents/revoke',
  Stylesheet = '/app.css',
  Favicon = '/favicon.svg',
}

export function localeOfPath(input: { path: string }): OwnerLocale {
  const { path } = input;
  const isPortuguese = path === CLIENT_APP_PORTUGUESE_PATH_PREFIX || path.startsWith(`${CLIENT_APP_PORTUGUESE_PATH_PREFIX}/`);
  return isPortuguese ? OwnerLocale.PortugueseBrazil : OwnerLocale.EnglishUs;
}

export function pathWithLocale(input: { locale: OwnerLocale; path: string }): string {
  const prefix = CLIENT_APP_LOCALE_PATH_PREFIXES[input.locale];
  const isRootWithPrefix = input.path === ClientAppPath.Home && prefix !== '';
  if (isRootWithPrefix) return prefix;
  return `${prefix}${input.path}`;
}

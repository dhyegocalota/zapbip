import type { OwnerLocale } from '@zapbip/types';

export enum ClientAppPath {
  Home = '/',
  SignIn = '/sign-in',
  SignOut = '/sign-out',
  Agents = '/agents',
  RevokeAgent = '/agents/revoke',
  Stylesheet = '/app.css',
  Favicon = '/favicon.svg',
}

export function localeOfPath(_input: { path: string }): OwnerLocale {
  throw new Error('localeOfPath is not implemented');
}

export function pathWithLocale(_input: { locale: OwnerLocale; path: string }): string {
  throw new Error('pathWithLocale is not implemented');
}

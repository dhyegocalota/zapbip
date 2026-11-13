import { CLIENT_APP_LOCALE_PATH_PREFIXES, CLIENT_APP_SIGN_IN_PATH_PREFIX, type OwnerLocale } from '@zapbip/types';

export function buildSignInLink(input: { appOrigin: string; locale: OwnerLocale; token: string }): string {
  return `${input.appOrigin}${CLIENT_APP_LOCALE_PATH_PREFIXES[input.locale]}${CLIENT_APP_SIGN_IN_PATH_PREFIX}${input.token}`;
}

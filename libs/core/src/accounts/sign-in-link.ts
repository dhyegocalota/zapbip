import { CLIENT_APP_PORTUGUESE_PATH_PREFIX, CLIENT_APP_SIGN_IN_PATH_PREFIX, OwnerLocale } from '@zapbip/types';

const LOCALE_PATH_PREFIXES: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: CLIENT_APP_PORTUGUESE_PATH_PREFIX,
  [OwnerLocale.EnglishUs]: '',
};

export function buildSignInLink(input: { appOrigin: string; locale: OwnerLocale; token: string }): string {
  return `${input.appOrigin}${LOCALE_PATH_PREFIXES[input.locale]}${CLIENT_APP_SIGN_IN_PATH_PREFIX}${input.token}`;
}

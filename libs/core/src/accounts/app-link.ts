import { CLIENT_APP_LOCALE_PATH_PREFIXES, type OwnerLocale } from '@zapbip/types';

export function buildAppLink(input: { appOrigin: string; locale: OwnerLocale }): string {
  return `${input.appOrigin}${CLIENT_APP_LOCALE_PATH_PREFIXES[input.locale]}`;
}

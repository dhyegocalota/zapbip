import { SECOND_MS } from '@zapbip/types';

export const ALARM_MIN_DELAY_MS = 5 * SECOND_MS;
export const OWNER_LOCALE_STORAGE_KEY = 'owner_locale';

export enum AlarmErrorCode {
  ProviderFailed = 'alarm_provider_failed',
  OwnerLocaleMissing = 'owner_locale_missing',
}

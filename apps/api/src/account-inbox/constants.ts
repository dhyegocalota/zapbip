import { SECOND_MS } from '@zapbip/types';

export const ALARM_MIN_DELAY_MS = 5 * SECOND_MS;
export const CONNECTOR_OBJECT_ORIGIN = 'https://account-inbox';
export const NORMAL_CLOSE_CODE = 1000;
export const UNREPLYABLE_CLOSE_CODES = [1005, 1006, 1015];
export const CONNECTOR_AGENT_PARAMETER = 'agent';
export const OWNER_LOCALE_STORAGE_KEY = 'owner_locale';

export enum AlarmErrorCode {
  ProviderFailed = 'alarm_provider_failed',
}

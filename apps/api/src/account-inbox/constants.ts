import { SECOND_MS } from '@zapbip/types';

export const ALARM_MIN_DELAY_MS = 5 * SECOND_MS;

export enum AlarmErrorCode {
  ProviderFailed = 'alarm_provider_failed',
}

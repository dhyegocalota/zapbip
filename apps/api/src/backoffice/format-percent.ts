import type { OwnerLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from './backoffice-copy';

const PERCENT_DECIMALS = 1;

export function formatPercent(input: { percent: number; locale: OwnerLocale }): string {
  return renderBackofficeCopy({
    key: BackofficeCopyKey.MetricsPercentValue,
    locale: input.locale,
    values: { value: input.percent.toFixed(PERCENT_DECIMALS) },
  });
}

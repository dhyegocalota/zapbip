import type { WebLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';
import { MetricsPeriod, NUMBER_QUERY, PERIOD_QUERY, type MetricsFilter } from './metrics-filter';
import type { NumberOption } from './metrics-report';

const PERIOD_LABELS: Record<MetricsPeriod, BackofficeCopyKey> = {
  [MetricsPeriod.Week]: BackofficeCopyKey.MetricsPeriod7,
  [MetricsPeriod.Month]: BackofficeCopyKey.MetricsPeriod30,
};

export function FilterForm(props: { locale: WebLocale; filter: MetricsFilter; numbers: NumberOption[] }) {
  const { locale, filter, numbers } = props;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  return (
    <form method="get" action={BackofficePath.Metrics} class="filter-form">
      <div class="field">
        <label for="metrics-number">{translate(BackofficeCopyKey.MetricsFilterNumber)}</label>
        <select id="metrics-number" name={NUMBER_QUERY}>
          <option value="" selected={filter.numberId === null}>
            {translate(BackofficeCopyKey.MetricsFilterNumberAll)}
          </option>
          {numbers.map((option) => (
            <option value={option.numberId} selected={filter.numberId === option.numberId}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div class="field">
        <label for="metrics-period">{translate(BackofficeCopyKey.MetricsFilterPeriod)}</label>
        <select id="metrics-period" name={PERIOD_QUERY}>
          {Object.values(MetricsPeriod).map((period) => (
            <option value={period} selected={filter.period === period}>
              {translate(PERIOD_LABELS[period])}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" class="button button-primary">
        {translate(BackofficeCopyKey.MetricsFilterApply)}
      </button>
    </form>
  );
}

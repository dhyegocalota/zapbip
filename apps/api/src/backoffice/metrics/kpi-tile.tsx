import type { WebLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { Sparkline } from '../views/sparkline';
import type { MetricCell } from './metric-cell';
import { Trend, trendOf } from './metrics-series';

const TREND_GLYPHS: Record<Trend, string> = { [Trend.Up]: '▲', [Trend.Down]: '▼', [Trend.Flat]: '▬' };
const TREND_COPY: Record<Trend, BackofficeCopyKey> = {
  [Trend.Up]: BackofficeCopyKey.MetricsDeltaUp,
  [Trend.Down]: BackofficeCopyKey.MetricsDeltaDown,
  [Trend.Flat]: BackofficeCopyKey.MetricsDeltaFlat,
};

export function KpiTile(props: {
  locale: WebLocale;
  label: string;
  value: string;
  cell: MetricCell;
  series: number[];
  currentTotal: number;
  previousTotal: number;
}) {
  const { locale, cell } = props;
  const { trend, amount } = trendOf({ current: props.currentTotal, previous: props.previousTotal });
  const labelId = `kpi-${cell}`;
  return (
    <div class="kpi">
      <p id={labelId} class="figure-label">
        {props.label}
      </p>
      <p class="kpi-value" aria-labelledby={labelId} data-cell={cell}>
        {props.value}
      </p>
      <p class={`kpi-delta kpi-delta-${trend}`} data-delta-for={cell}>
        <span aria-hidden="true">{TREND_GLYPHS[trend]}</span>
        <span>{renderBackofficeCopy({ key: TREND_COPY[trend], locale, values: { amount: String(amount) } })}</span>
      </p>
      <Sparkline id={`${labelId}-sparkline`} locale={locale} metricLabel={props.label} values={props.series} />
    </div>
  );
}

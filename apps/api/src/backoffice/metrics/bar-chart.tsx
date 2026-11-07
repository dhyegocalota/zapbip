import type { OwnerLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { keyedCell, type MetricCell } from './metric-cell';

export enum BarPattern {
  Solid = 'solid',
  Hatched = 'hatched',
}

export type ChartSeries = { label: string; cell: MetricCell; values: number[]; valueTexts: string[]; pattern: BarPattern };

const CHART_WIDTH = 640;
const PLOT_HEIGHT = 140;
const CHART_HEIGHT = 164;
const LABEL_BASELINE = 158;
const MAXIMUM_LABEL_BASELINE = 12;
const BAR_GAP = 2;
const DAY_LABEL_INTERVAL = 7;
const DAY_LABEL_START = 5;
const HATCH_SIZE = 6;
const HATCH_ROTATION = 45;
const MINIMUM_MAXIMUM = 1;

type Bar = { x: number; y: number; width: number; height: number; pattern: BarPattern };

function barsOf(input: { series: ChartSeries[]; maximum: number }): Bar[] {
  const dayCount = input.series.reduce((count, series) => Math.max(count, series.values.length), 0);
  const groupWidth = CHART_WIDTH / dayCount;
  const barWidth = (groupWidth - BAR_GAP) / input.series.length;
  return input.series.flatMap((series, seriesIndex) =>
    series.values.map((value, dayIndex) => {
      const height = (value / input.maximum) * PLOT_HEIGHT;
      return {
        x: dayIndex * groupWidth + BAR_GAP / 2 + seriesIndex * barWidth,
        y: PLOT_HEIGHT - height,
        width: barWidth,
        height,
        pattern: series.pattern,
      };
    }),
  );
}

export function BarChart(props: {
  locale: OwnerLocale;
  id: string;
  metricLabel: string;
  days: string[];
  series: ChartSeries[];
  totalText: string;
  today: string;
  isHourly: boolean;
}) {
  const { locale, id, days, series } = props;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const hasData = series.some((entry) => entry.values.some((value) => value > 0));
  if (!hasData) return <p class="empty-text">{translate(BackofficeCopyKey.MetricsNoData)}</p>;
  const maximum = Math.max(MINIMUM_MAXIMUM, ...series.flatMap((entry) => entry.values));
  const patternId = `${id}-hatch`;
  const [firstDay, lastDay] = [days.at(0), days.at(-1)];
  if (firstDay === undefined || lastDay === undefined) throw new Error('a chart needs at least one day');
  const title = translate(BackofficeCopyKey.ChartTitle, { metric: props.metricLabel, days: String(days.length) });
  const description = translate(BackofficeCopyKey.ChartDescription, { from: firstDay, to: lastDay, total: props.totalText });
  const patternLabels: Record<BarPattern, BackofficeCopyKey> = {
    [BarPattern.Solid]: BackofficeCopyKey.ChartLegendSolid,
    [BarPattern.Hatched]: BackofficeCopyKey.ChartLegendHatched,
  };
  return (
    <figure class="chart">
      <svg class="chart-plot" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{description}</desc>
        <defs>
          <pattern
            id={patternId}
            width={HATCH_SIZE}
            height={HATCH_SIZE}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${HATCH_ROTATION})`}
          >
            <line class="hatch-line" x1="0" y1="0" x2="0" y2={HATCH_SIZE} />
          </pattern>
        </defs>
        {barsOf({ series, maximum }).map((bar) => (
          <rect
            class={`bar bar-${bar.pattern}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill={bar.pattern === BarPattern.Hatched ? `url(#${patternId})` : undefined}
          />
        ))}
        <line class="chart-baseline" x1="0" y1={PLOT_HEIGHT} x2={CHART_WIDTH} y2={PLOT_HEIGHT} />
        <text class="chart-axis-label" x="0" y={MAXIMUM_LABEL_BASELINE}>
          {maximum}
        </text>
        {days.map((day, index) =>
          index % DAY_LABEL_INTERVAL === 0 ? (
            <text class="chart-axis-label" x={(index * CHART_WIDTH) / days.length} y={LABEL_BASELINE}>
              {day.slice(DAY_LABEL_START)}
            </text>
          ) : null,
        )}
      </svg>
      {series.length > 1 ? (
        <ul class="chart-legend">
          {series.map((entry) => (
            <li>
              {entry.label} ({translate(patternLabels[entry.pattern])})
            </li>
          ))}
        </ul>
      ) : null}
      <details>
        <summary>{translate(BackofficeCopyKey.MetricsShowValues)}</summary>
        <table class="data-table">
          <caption class="visually-hidden">{title}</caption>
          <thead>
            <tr>
              <th scope="col">{translate(BackofficeCopyKey.ColumnDay)}</th>
              {series.map((entry) => (
                <th scope="col">{entry.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, index) => (
              <tr>
                <th scope="row">
                  {day}
                  {day === props.today && props.isHourly ? ` (${translate(BackofficeCopyKey.MetricsUpdatesHourly)})` : ''}
                </th>
                {series.map((entry) => (
                  <td data-label={entry.label} data-cell={keyedCell({ cell: entry.cell, key: day })}>
                    {entry.valueTexts.at(index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

import type { OwnerLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { keyedCell, type MetricCell } from './metric-cell';

export enum BarPattern {
  Solid = 'solid',
  Hatched = 'hatched',
}

export type ChartReference = { value: number; label: string };

export type ChartSeries = { label: string; cell: MetricCell; values: number[]; valueTexts: string[]; pattern: BarPattern };

export const BAR_RADIUS = 2;
export enum ChartSize {
  Compact = 'compact',
  Wide = 'wide',
}

type ChartLayout = { leftGutter: number; plotWidth: number; chartWidth: number };

const CHART_GUTTERS: Record<ChartSize, { leftGutter: number; plotWidth: number; rightGutter: number }> = {
  [ChartSize.Wide]: { leftGutter: 52, plotWidth: 548, rightGutter: 120 },
  [ChartSize.Compact]: { leftGutter: 36, plotWidth: 300, rightGutter: 16 },
};

function layoutOf(input: { size: ChartSize }): ChartLayout {
  const { leftGutter, plotWidth, rightGutter } = CHART_GUTTERS[input.size];
  return { leftGutter, plotWidth, chartWidth: leftGutter + plotWidth + rightGutter };
}
const TOP_MARGIN = 20;
const PLOT_HEIGHT = 140;
const BASELINE_Y = TOP_MARGIN + PLOT_HEIGHT;
const DAY_LABEL_Y = BASELINE_Y + 18;
const CHART_HEIGHT = DAY_LABEL_Y + 8;
const HEADROOM_RATIO = 1.08;
const AXIS_LABEL_GAP = 6;
const LABEL_BASELINE_SHIFT = 4;
const REFERENCE_LABEL_GAP = 8;
const REFERENCE_LABEL_HEIGHT = 14;
const BAR_GAP = 2;
const DAY_LABEL_INTERVAL = 7;
const DAY_LABEL_START = 5;
const HATCH_SIZE = 6;
const HATCH_ROTATION = 45;
const MINIMUM_MAXIMUM = 1;

type Bar = { x: number; y: number; width: number; height: number; pattern: BarPattern };
type PlacedReference = ChartReference & { lineY: number; labelY: number };

function plotY(input: { value: number; scale: number }): number {
  return BASELINE_Y - (input.value / input.scale) * PLOT_HEIGHT;
}

function barsOf(input: { series: ChartSeries[]; scale: number; layout: ChartLayout }): Bar[] {
  const dayCount = input.series.reduce((count, series) => Math.max(count, series.values.length), 0);
  const groupWidth = input.layout.plotWidth / dayCount;
  const barWidth = (groupWidth - BAR_GAP) / input.series.length;
  return input.series.flatMap((series, seriesIndex) =>
    series.values.map((value, dayIndex) => {
      const y = plotY({ value, scale: input.scale });
      return {
        x: input.layout.leftGutter + dayIndex * groupWidth + BAR_GAP / 2 + seriesIndex * barWidth,
        y,
        width: barWidth,
        height: BASELINE_Y - y,
        pattern: series.pattern,
      };
    }),
  );
}

function placeReferences(input: { references: ChartReference[]; scale: number }): PlacedReference[] {
  const highestFirst = [...input.references].sort((first, second) => second.value - first.value);
  return highestFirst.reduce<PlacedReference[]>((placed, reference) => {
    const lineY = plotY({ value: reference.value, scale: input.scale });
    const previous = placed.at(-1);
    const labelY = previous === undefined ? lineY : Math.max(lineY, previous.labelY + REFERENCE_LABEL_HEIGHT);
    return [...placed, { ...reference, lineY, labelY }];
  }, []);
}

export function BarChart(props: {
  size: ChartSize;
  locale: OwnerLocale;
  id: string;
  metricLabel: string;
  days: string[];
  series: ChartSeries[];
  totalText: string;
  today: string;
  isHourly: boolean;
  references?: ChartReference[];
}) {
  const { locale, id, days, series } = props;
  const layout = layoutOf({ size: props.size });
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const hasData = series.some((entry) => entry.values.some((value) => value > 0));
  if (!hasData) return <p class="empty-inline">{translate(BackofficeCopyKey.MetricsNoData)}</p>;
  const references = props.references === undefined ? [] : props.references;
  const maximum = Math.max(MINIMUM_MAXIMUM, ...series.flatMap((entry) => entry.values), ...references.map((reference) => reference.value));
  const scale = maximum * HEADROOM_RATIO;
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
      <svg class="chart-plot" viewBox={`0 0 ${layout.chartWidth} ${CHART_HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
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
        {barsOf({ series, scale, layout }).map((bar) => (
          <rect
            class={`bar bar-${bar.pattern}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            rx={BAR_RADIUS}
            height={bar.height}
            fill={bar.pattern === BarPattern.Hatched ? `url(#${patternId})` : undefined}
          />
        ))}
        {placeReferences({ references, scale }).map((reference) => (
          <g>
            <line
              class="chart-reference"
              x1={layout.leftGutter}
              y1={reference.lineY}
              x2={layout.leftGutter + layout.plotWidth}
              y2={reference.lineY}
            />
            <text
              class="chart-axis-label chart-reference-label"
              x={layout.leftGutter + layout.plotWidth + REFERENCE_LABEL_GAP}
              y={reference.labelY + LABEL_BASELINE_SHIFT}
            >
              {reference.label}
            </text>
          </g>
        ))}
        <line class="chart-baseline" x1={layout.leftGutter} y1={BASELINE_Y} x2={layout.leftGutter + layout.plotWidth} y2={BASELINE_Y} />
        <text
          class="chart-axis-label chart-axis-maximum"
          x={layout.leftGutter - AXIS_LABEL_GAP}
          y={plotY({ value: maximum, scale }) + LABEL_BASELINE_SHIFT}
          text-anchor="end"
        >
          {maximum}
        </text>
        {days.map((day, index) =>
          index % DAY_LABEL_INTERVAL === 0 ? (
            <text class="chart-axis-label" x={layout.leftGutter + (index * layout.plotWidth) / days.length} y={DAY_LABEL_Y}>
              {day.slice(DAY_LABEL_START)}
            </text>
          ) : null,
        )}
      </svg>
      {series.length > 1 ? (
        <ul class="chart-legend">
          {series.map((entry) => (
            <li>
              <span class={`legend-swatch legend-swatch-${entry.pattern}`}></span>
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

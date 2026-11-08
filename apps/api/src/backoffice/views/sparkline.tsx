import type { OwnerLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';

const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 56;
const VERTICAL_MARGIN = 6;
const HORIZONTAL_MARGIN = 4;
const LABEL_GUTTER = 34;
const LABEL_GAP = 4;
const LABEL_BASELINE_SHIFT = 4;
const BASELINE_Y = VIEW_HEIGHT - VERTICAL_MARGIN;
const EMPTY_TOP = 34;
const DOT_RADIUS = 3;
const TITLE_SEPARATOR = ' ';
const POINT_SEPARATOR = ' ';
const COORDINATE_PRECISION = 2;

type Point = { x: number; y: number };

function assertDrawable(input: { values: number[] }): void {
  const invalid = input.values.find((value) => !Number.isFinite(value) || value < 0);
  if (invalid !== undefined) throw new Error(`a sparkline cannot draw the value ${invalid}`);
}

function roundOf(value: number): number {
  return Number(value.toFixed(COORDINATE_PRECISION));
}

function pointsOf(input: { values: number[]; peak: number }): Point[] {
  const { values, peak } = input;
  const step = (VIEW_WIDTH - 2 * HORIZONTAL_MARGIN - LABEL_GUTTER) / (values.length - 1);
  return values.map((value, index) => ({
    x: roundOf(HORIZONTAL_MARGIN + index * step),
    y: roundOf(BASELINE_Y - (value / peak) * (BASELINE_Y - VERTICAL_MARGIN)),
  }));
}

function pairOf(point: Point): string {
  return `${point.x},${point.y}`;
}

export function Sparkline(props: { id: string; locale: OwnerLocale; metricLabel: string; values: number[] }) {
  const { id, locale, metricLabel, values } = props;
  assertDrawable({ values });
  const translate = (key: BackofficeCopyKey, replacements: Record<string, string>): string =>
    renderBackofficeCopy({ key, locale, values: replacements });
  const peak = Math.max(...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const isEmpty = peak === 0;
  const summary = isEmpty
    ? translate(BackofficeCopyKey.SparklineEmpty, { days: String(values.length) })
    : translate(BackofficeCopyKey.SparklineSummary, { total: String(total), peak: String(peak) });
  const title = `${translate(BackofficeCopyKey.ChartTitle, { metric: metricLabel, days: String(values.length) })}${TITLE_SEPARATOR}${summary}`;
  const points = isEmpty ? [] : pointsOf({ values, peak });
  const lastPoint = points.at(-1);
  const firstPoint = points.at(0);
  return (
    <>
      <svg
        class="sparkline"
        viewBox={isEmpty ? `0 ${EMPTY_TOP} ${VIEW_WIDTH} ${VIEW_HEIGHT - EMPTY_TOP}` : `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
      >
        <title>{title}</title>
        {isEmpty ? null : (
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop class="sparkline-stop-start" offset="0" />
              <stop class="sparkline-stop-end" offset="1" />
            </linearGradient>
          </defs>
        )}
        {firstPoint === undefined || lastPoint === undefined ? null : (
          <>
            <polygon
              class="sparkline-area"
              fill={`url(#${id}-fill)`}
              points={[{ x: firstPoint.x, y: BASELINE_Y }, ...points, { x: lastPoint.x, y: BASELINE_Y }].map(pairOf).join(POINT_SEPARATOR)}
            />
            <polyline class="sparkline-line" points={points.map(pairOf).join(POINT_SEPARATOR)} />
            <circle class="sparkline-dot" cx={lastPoint.x} cy={lastPoint.y} r={DOT_RADIUS} />
            <text class="sparkline-label" x={lastPoint.x + DOT_RADIUS + LABEL_GAP} y={lastPoint.y + LABEL_BASELINE_SHIFT}>
              {values.at(-1)}
            </text>
          </>
        )}
        <line class="sparkline-baseline" x1={HORIZONTAL_MARGIN} y1={BASELINE_Y} x2={VIEW_WIDTH - HORIZONTAL_MARGIN} y2={BASELINE_Y} />
      </svg>
      <p class="sparkline-summary">{summary}</p>
    </>
  );
}

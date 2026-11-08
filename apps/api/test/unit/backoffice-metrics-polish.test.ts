import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { BAR_RADIUS } from '../../src/backoffice/metrics/bar-chart';
import { MetricCell } from '../../src/backoffice/metrics/metric-cell';
import { ActivityMetric } from '../../src/contract/activity-metric';
import { MetricsPage } from '../../src/backoffice/metrics/metrics-page';
import { DATA_REPORT, EMPTY_REPORT, METRICS_FILTER, NOW, PAGE } from './backoffice-page-fixtures';

const copy = BACKOFFICE_COPY[OwnerLocale.EnglishUs];
const FRESHNESS_LINE_PATTERN = /<p class="figure-freshness([^"]*)">([^]*?)<\/p>/g;
const BAR_PATTERN = /<rect class="bar [^"]*"[^>]*>/g;
const LEGEND_ITEM_PATTERN = /<li>(<span class="legend-swatch [^"]*"><\/span>)?[^<]*\(/g;
const LEGEND_ITEMS_PATTERN = /<ul class="chart-legend">([^]*?)<\/ul>/g;
const EMPTY_STATE_PATTERN = /class="card hero-card empty-state"/g;
const FIGURE_COUNT = 3;
const KPI_CELLS = [MetricCell.Accounts, MetricCell.MessagesIn, MetricCell.MessagesOut, MetricCell.WakesWoken, MetricCell.SendsFailed];
const PREVIOUS_PERIOD_DAY = '2026-10-28';
const TODAY = '2026-11-07';
const HERO_CARD_PATTERN = /class="card hero-card"/g;
const FIRST_CARD_PATTERN = /<section class="card[^"]*"/;

function render(input: { data: boolean }): string {
  return String(MetricsPage({ page: PAGE, filter: METRICS_FILTER, report: input.data ? DATA_REPORT : EMPTY_REPORT, now: NOW }));
}

describe('metrics polish', () => {
  it('marks every freshness line as live or hourly', () => {
    const lines = [...render({ data: true }).matchAll(FRESHNESS_LINE_PATTERN)];
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach(([, classes]) => expect(classes).toMatch(/freshness-(live|hourly)/));
  });

  it('puts the live dot and the word Live in every live line and neither in an hourly line', () => {
    const lines = [...render({ data: true }).matchAll(FRESHNESS_LINE_PATTERN)];
    const liveLines = lines.filter(([, classes]) => classes!.includes('freshness-live'));
    const hourlyLines = lines.filter(([, classes]) => classes!.includes('freshness-hourly'));
    expect(liveLines.length).toBeGreaterThan(0);
    expect(hourlyLines.length).toBeGreaterThan(0);
    liveLines.forEach(([, , body]) => {
      expect(body).toContain('<span class="live-dot" aria-hidden="true"></span>');
      expect(body).toContain(copy[BackofficeCopyKey.MetricsFreshnessLive]);
    });
    hourlyLines.forEach(([, , body]) => {
      expect(body).not.toContain('live-dot');
      expect(body).toContain(copy[BackofficeCopyKey.MetricsFreshnessHourly]);
    });
  });

  it('rounds every bar by the bar radius', () => {
    const bars = render({ data: true }).match(BAR_PATTERN);
    expect(bars?.length).toBeGreaterThan(0);
    bars!.forEach((bar) => expect(bar).toContain(`rx="${BAR_RADIUS}"`));
  });

  it('labels the reference lines with the reference label class', () => {
    expect(render({ data: true })).toContain('class="chart-axis-label chart-reference-label"');
  });

  it('puts a swatch before the text of every legend item', () => {
    const legends = [...render({ data: true }).matchAll(LEGEND_ITEMS_PATTERN)];
    expect(legends.length).toBeGreaterThan(0);
    legends.forEach(([, items]) => {
      const entries = [...items!.matchAll(LEGEND_ITEM_PATTERN)];
      expect(entries.length).toBeGreaterThan(0);
      entries.forEach(([, swatch]) => expect(swatch).toBeTypeOf('string'));
    });
  });

  it('makes the first card the only hero card', () => {
    const html = render({ data: true });
    expect(html.match(HERO_CARD_PATTERN)).toHaveLength(1);
    expect(html.match(FIRST_CARD_PATTERN)?.[0]).toContain('hero-card');
  });

  it('shows one page-level empty state and no section card when there is no activity at all', () => {
    const html = render({ data: false });
    expect(html.match(EMPTY_STATE_PATTERN)).toHaveLength(1);
    expect(html).not.toContain('aria-labelledby="metrics-');
    expect(html).not.toContain('empty-inline');
    expect(html).toContain(copy[BackofficeCopyKey.MetricsNoData]);
  });

  it('keeps the five tiles and the three figures above the page-level empty state', () => {
    const html = render({ data: false });
    expect(html.match(/class="kpi"/g)).toHaveLength(KPI_CELLS.length);
    expect(html.match(/class="figure"/g)).toHaveLength(FIGURE_COUNT);
  });

  it('shows a compact inline line, not the bubble, for an empty section among sections with data', () => {
    const report = { ...DATA_REPORT, restricted: [], agentsByClient: [] };
    const html = String(MetricsPage({ page: PAGE, filter: METRICS_FILTER, report, now: NOW }));
    expect(html).not.toContain('empty-state');
    expect(html).toContain(`<p class="empty-inline">${copy[BackofficeCopyKey.MetricsNoData]}</p>`);
    expect(html.match(HERO_CARD_PATTERN)).toHaveLength(1);
  });

  it.each(KPI_CELLS)('shows the %s tile once, with a sparkline and a delta line', (cell) => {
    const html = render({ data: true });
    expect(html.match(new RegExp(`data-cell="${cell}"`, 'g'))).toHaveLength(1);
    const tile = html.split('<div class="kpi">').find((part) => part.includes(`data-cell="${cell}"`));
    expect(tile).toContain('<svg class="sparkline"');
    expect(tile).toMatch(/class="kpi-delta[^"]*"/);
  });

  it('puts the tiles in one grid before one grid of chart cards, the budget card wide', () => {
    const html = render({ data: true });
    expect(html.indexOf('class="kpi-grid"')).toBeGreaterThan(-1);
    expect(html.indexOf('class="kpi-grid"')).toBeLessThan(html.indexOf('class="chart-grid"'));
    expect(html).toMatch(/<section class="card chart-card-wide" aria-labelledby="metrics-budget-title">/);
  });

  it.each([
    [4, 6, 'kpi-delta-down', '▼', '2 fewer than the previous period'],
    [6, 4, 'kpi-delta-up', '▲', '2 more than the previous period'],
    [5, 5, 'kpi-delta-flat', '▬', 'Same as the previous period'],
  ])('compares messages in %s with the previous period %s as text and a glyph', (current, previous, kind, glyph, sentence) => {
    const activity = [
      { day: TODAY, metric: ActivityMetric.MessagesIn, total: current },
      { day: PREVIOUS_PERIOD_DAY, metric: ActivityMetric.MessagesIn, total: previous },
    ];
    const html = String(MetricsPage({ page: PAGE, filter: METRICS_FILTER, report: { ...DATA_REPORT, activity }, now: NOW }));
    const delta = html.match(/<p class="kpi-delta ([^"]+)" data-delta-for="messages-in">([^]*?)<\/p>/)!;
    expect(delta[1]).toBe(kind);
    expect(delta[2]).toContain(`<span aria-hidden="true">${glyph}</span>`);
    expect(delta[2]).toContain(sentence);
  });

  it('leaves the previous period out of the totals', () => {
    const activity = [
      { day: TODAY, metric: ActivityMetric.MessagesIn, total: 4 },
      { day: PREVIOUS_PERIOD_DAY, metric: ActivityMetric.MessagesIn, total: 600 },
    ];
    const html = String(MetricsPage({ page: PAGE, filter: METRICS_FILTER, report: { ...DATA_REPORT, activity }, now: NOW }));
    expect(html).toMatch(/data-cell="messages-in">4</);
  });
});

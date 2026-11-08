import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { BAR_RADIUS } from '../../src/backoffice/metrics/bar-chart';
import { MetricsPage } from '../../src/backoffice/metrics/metrics-page';
import { DATA_REPORT, EMPTY_REPORT, METRICS_FILTER, NOW, PAGE } from './backoffice-page-fixtures';

const copy = BACKOFFICE_COPY[OwnerLocale.EnglishUs];
const FRESHNESS_LINE_PATTERN = /<p class="figure-freshness([^"]*)">([^]*?)<\/p>/g;
const BAR_PATTERN = /<rect class="bar [^"]*"[^>]*>/g;
const LEGEND_ITEM_PATTERN = /<li>(<span class="legend-swatch [^"]*"><\/span>)?[^<]*\(/g;
const LEGEND_ITEMS_PATTERN = /<ul class="chart-legend">([^]*?)<\/ul>/g;
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

  it('renders the empty state once per empty section and no empty text', () => {
    const html = render({ data: false });
    expect(html).toContain('class="empty-state"');
    expect(html).not.toContain('empty-text');
    expect(html).toContain(copy[BackofficeCopyKey.MetricsNoData]);
  });
});

import { WebLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { Sparkline } from '../../src/backoffice/views/sparkline';

const DAY_COUNT = 14;
const SPARKLINE_ID = 'spark';
const METRIC_LABEL = 'Messages';
const RISING = Array.from({ length: DAY_COUNT }, (_, index) => index);
const ZEROS = new Array<number>(DAY_COUNT).fill(0);
const SINGLE_DAY = [...new Array<number>(DAY_COUNT - 2).fill(0), 3, 0];
const VIEW_BOX_PATTERN = /viewBox="0 0 (\d+) (\d+)"/;
const VIEW_BOX_PATTERN_ANY = /viewBox="0 (\d+) \d+ (\d+)"/;
const POINTS_PATTERN = /<polyline[^>]*\spoints="([^"]+)"/;
const TITLE_PATTERN = /<svg[^>]*><title>([^<]*)<\/title>/;
const SUMMARY_PATTERN = /<p class="sparkline-summary">([^<]*)<\/p>/;

function render(input: { values: number[]; locale?: WebLocale }): string {
  const { locale = WebLocale.EnglishUs } = input;
  return String(Sparkline({ id: SPARKLINE_ID, locale, metricLabel: METRIC_LABEL, values: input.values }));
}

function pointsOf(html: string): { x: number; y: number }[] {
  const match = html.match(POINTS_PATTERN);
  if (match === null) throw new Error('the sparkline has no polyline');
  return match[1]!.split(' ').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x: x!, y: y! };
  });
}

function textOf(input: { html: string; pattern: RegExp }): string {
  const match = input.html.match(input.pattern);
  if (match === null) throw new Error(`no match for ${input.pattern}`);
  return match[1]!;
}

describe('sparkline', () => {
  it('draws fourteen points as one polyline inside an img svg', () => {
    const html = render({ values: RISING });
    expect(html).toContain('<svg class="sparkline"');
    expect(html).toContain('role="img"');
    expect(pointsOf(html)).toHaveLength(DAY_COUNT);
  });

  it('puts the maximum on the top margin and the minimum on the baseline', () => {
    const html = render({ values: RISING });
    const height = Number(html.match(VIEW_BOX_PATTERN)![2]);
    const ys = pointsOf(html).map((point) => point.y);
    expect(Math.min(...ys)).toBeLessThan(Math.max(...ys));
    expect(Math.max(...ys)).toBeLessThan(height);
    expect(ys.at(-1)).toBe(Math.min(...ys));
    expect(ys.at(0)).toBe(Math.max(...ys));
  });

  it('orders the points from left to right, oldest first', () => {
    const xs = pointsOf(render({ values: RISING })).map((point) => point.x);
    expect(xs).toEqual([...xs].sort((first, second) => first - second));
  });

  it('draws only the baseline and says so in words for an all-zero series', () => {
    const html = render({ values: ZEROS });
    expect(html).not.toContain('<polyline');
    expect(html).toContain('sparkline-baseline');
    expect(textOf({ html, pattern: SUMMARY_PATTERN })).toBe('No activity in the last 14 days');
    expect(textOf({ html, pattern: TITLE_PATTERN })).toBe('Messages, last 14 days No activity in the last 14 days');
  });

  it('shows a drawn line and the last-point dot for one non-zero day among zeros', () => {
    const html = render({ values: SINGLE_DAY });
    expect(pointsOf(html)).toHaveLength(DAY_COUNT);
    expect(html).toContain('sparkline-dot');
    expect(textOf({ html, pattern: SUMMARY_PATTERN })).toBe('3 in total, peak of 3 in one day');
  });

  it.each([
    [WebLocale.EnglishUs, 'Messages, last 14 days 91 in total, peak of 13 in one day'],
    [WebLocale.PortugueseBrazil, 'Messages, últimos 14 dias 91 no total, pico de 13 em um dia'],
  ])('names the chart with its numbers in %s', (locale, expectedTitle) => {
    expect(textOf({ html: render({ values: RISING, locale }), pattern: TITLE_PATTERN })).toBe(expectedTitle);
  });

  it('shows the same summary beside the svg as in its title', () => {
    const html = render({ values: RISING });
    expect(textOf({ html, pattern: TITLE_PATTERN }).endsWith(textOf({ html, pattern: SUMMARY_PATTERN }))).toBe(true);
  });

  it('carries no inline style and no script', () => {
    const html = render({ values: RISING });
    expect(html).not.toMatch(/\sstyle=|<script/);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('throws naming the value %s', (value) => {
    expect(() => render({ values: [...RISING.slice(1), value] })).toThrow(String(value));
  });

  it('crops an all-zero series to a shorter box than a drawn one', () => {
    const heightOf = (html: string): number => Number(html.match(VIEW_BOX_PATTERN_ANY)![2]);
    expect(heightOf(render({ values: ZEROS }))).toBeLessThan(heightOf(render({ values: RISING })));
  });

  it('fills the area from one gradient defined once in the svg', () => {
    const html = render({ values: RISING });
    expect(html.match(/<linearGradient id="spark-fill"/g)).toHaveLength(1);
    expect(html).toMatch(/<polygon class="sparkline-area"[^>]*fill="url\(#spark-fill\)"/);
    expect(html).toMatch(/<stop class="sparkline-stop-start"/);
    expect(html).toMatch(/<stop class="sparkline-stop-end"/);
  });

  it('labels the last value to the right of the end dot', () => {
    const html = render({ values: RISING });
    const dot = html.match(/<circle class="sparkline-dot" cx="([\d.]+)" cy="([\d.]+)"/)!;
    const label = html.match(/<text class="sparkline-label" x="([\d.]+)" y="([\d.]+)">(\d+)<\/text>/)!;
    expect(Number(label[1])).toBeGreaterThan(Number(dot[1]));
    expect(label[3]).toBe(String(RISING.at(-1)));
  });

  it('draws no gradient, label or dot for an all-zero series', () => {
    const html = render({ values: ZEROS });
    ['linearGradient', 'sparkline-label', 'sparkline-dot'].forEach((marker) => expect(html).not.toContain(marker));
  });
});

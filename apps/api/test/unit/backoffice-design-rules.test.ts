import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HttpStatus, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../src/backoffice/audit/backoffice-audit-action';
import { BackofficeNotice } from '../../src/backoffice/backoffice-notice';
import { BackofficeTheme } from '../../src/backoffice/backoffice-theme';
import { MetricsPage } from '../../src/backoffice/metrics/metrics-page';
import { NumberDetailPage } from '../../src/backoffice/numbers/views/number-detail';
import { NumbersListPage } from '../../src/backoffice/numbers/views/numbers-list';
import { AuditPage } from '../../src/backoffice/views/audit';
import { ErrorPage } from '../../src/backoffice/views/error-page';
import { HomePage } from '../../src/backoffice/views/home';
import { SignInPage } from '../../src/backoffice/views/sign-in';
import { DeployEnvironment } from '../../src/contract/deploy-environment';
import { DATA_REPORT, EMPTY_REPORT, homeOverview, METRICS_FILTER, NOW, numberEntry } from './backoffice-page-fixtures';

const BACKOFFICE_ROOT = join(import.meta.dirname, '../../src/backoffice');
const STYLESHEET = readFileSync(join(BACKOFFICE_ROOT, 'assets/backoffice.css'), 'utf8');
const RAW_COLOUR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const CLASS_ATTRIBUTE_PATTERN = /class="([^"$]+)"/g;
const SELECTOR_CLASS_PATTERN = /\.([a-z][a-z0-9-]*)/g;
const STATE_ONLY_CLASSES = [
  'audit-row',
  'number-row',
  'template-row',
  'outcome',
  'outcome-succeeded',
  'budget-status',
  'bar',
  'chart-axis-maximum',
];
const FORCED_COLORS_PATTERN = /@media \(forced-colors: active\)/;
const FORCED_COLORS_BLOCK_PATTERN = /@media \(forced-colors: active\) \{[\s\S]*?\n\}/;
const FIELDSET_RULE_PATTERN = /\nfieldset \{[^}]*border: 0;/;
const LEGEND_RULE_PATTERN = /\nlegend \{[^}]*font-weight: 600;/;
const TOP_LEVEL_LINE_PATTERN = /^\S/;
const BLOCK_END = '}';
const REDUCED_MOTION_GUARD_PATTERN =
  /@media \(prefers-reduced-motion: reduce\) \{\s*\*,\s*\*::before,\s*\*::after \{\s*animation: none !important;\s*transition: none !important;\s*\}\s*\}/;
const INFINITE_ANIMATION_PATTERN = /animation[a-z-]*:[^;]*\binfinite\b/;
const SMOOTH_SCROLL_PATTERN = /scroll-behavior:\s*smooth/;
const FORCED_COLOR_OPT_OUT_PATTERN = /forced-color-adjust:\s*none/;
const HERO_CARD_RULE_PATTERN = /\n\.hero-card \{[^}]*\}/;
const TOKEN_BLOCK_PATTERN = /:root[^{]*\{[^}]*\}/g;
const ICON_RULE_PATTERN = /\n\.icon \{[^}]*width: [^;]+;[^}]*height: [^;]+;/;
const THEME_SWITCH_BUTTON_RULE_PATTERN =
  /\n\.theme-switch \.button \{[^}]*min-height: var\(--size-tap\);[^}]*min-width: var\(--size-tap\);/;
const SWITCHER_NOWRAP_PATTERN = /\n\.locale-switch,\n\.theme-switch \{[^}]*flex-wrap: nowrap;[^}]*white-space: nowrap;/;
const NARROW_BLOCK_PATTERN = /@media \(max-width: 40rem\) \{[\s\S]*?\n\}/;

const PAGE = {
  locale: OwnerLocale.EnglishUs,
  theme: BackofficeTheme.System,
  environment: DeployEnvironment.Production,
  stylesheetHref: '/assets/backoffice.css?v=1',
  csrfToken: 'token',
  notice: null,
};

function detailPage(input: { state: WhatsAppNumberState }): string {
  return String(
    NumberDetailPage({
      page: PAGE,
      entry: numberEntry({ state: input.state }),
      siblingLabels: [],
      allowedTargets: [WhatsAppNumberState.Closed],
      failure: null,
      selectedState: null,
    }),
  );
}

const PAGES: Record<string, string> = {
  signIn: String(SignInPage({ ...PAGE, notice: BackofficeNotice.SignInFailed })),
  home: String(HomePage({ page: PAGE, overview: homeOverview({ counts: { pending: 1, active: 2, closed: 0, disabled: 0 } }) })),
  homeEmpty: String(HomePage({ page: PAGE, overview: homeOverview({ counts: { pending: 0, active: 0, closed: 0, disabled: 0 } }) })),
  audit: String(
    AuditPage({
      page: PAGE,
      rows: [
        {
          at: 0,
          action: BackofficeAuditAction.SignOut,
          target_kind: null,
          target_id: null,
          outcome: BackofficeAuditOutcome.Succeeded,
          client_address: null,
        },
      ],
    }),
  ),
  numbersList: String(
    NumbersListPage({ page: PAGE, entries: [numberEntry({}), numberEntry({ numberId: 'num_two', state: WhatsAppNumberState.Pending })] }),
  ),
  numbersEmpty: String(NumbersListPage({ page: PAGE, entries: [] })),
  auditEmpty: String(AuditPage({ page: PAGE, rows: [] })),
  detailPending: detailPage({ state: WhatsAppNumberState.Pending }),
  detailActive: detailPage({ state: WhatsAppNumberState.Active }),
  detailDisabled: detailPage({ state: WhatsAppNumberState.Disabled }),
  metricsEmpty: String(MetricsPage({ page: PAGE, filter: METRICS_FILTER, report: EMPTY_REPORT, now: NOW })),
  metricsData: String(MetricsPage({ page: PAGE, filter: METRICS_FILTER, report: DATA_REPORT, now: NOW })),
  notFound: String(
    ErrorPage({ status: HttpStatus.NotFound, locale: OwnerLocale.EnglishUs, theme: BackofficeTheme.System, environment: null }),
  ),
};

function viewSources(input: { directory: string }): { path: string; source: string }[] {
  return readdirSync(input.directory).flatMap((name) => {
    const path = join(input.directory, name);
    if (statSync(path).isDirectory()) return viewSources({ directory: path });
    return name.endsWith('.tsx') ? [{ path, source: readFileSync(path, 'utf8') }] : [];
  });
}

describe('design rules', () => {
  it('has no style attribute, style element or script element in any view', () => {
    const offenders = viewSources({ directory: BACKOFFICE_ROOT })
      .filter(({ source }) => /\sstyle=|<style|<script/.test(source))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it.each(Object.entries(PAGES))('renders %s with one h1 and the skip link first', (_name, html) => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    const firstFocusable = html.search(/<(a|button|input|select|textarea)\b/);
    expect(html.slice(firstFocusable)).toMatch(/^<a href="#content"/);
  });

  it.each(Object.entries(PAGES))('labels every visible input on %s', (_name, html) => {
    const inputIds = [...html.matchAll(/<input(?![^>]*type="hidden")[^>]*\sid="([^"]+)"/g)].map((match) => match[1]!);
    inputIds.forEach((id) => expect(html).toContain(`<label for="${id}"`));
  });

  it('holds no raw colour outside the token blocks', () => {
    expect(STYLESHEET.replace(TOKEN_BLOCK_PATTERN, '')).not.toMatch(RAW_COLOUR_PATTERN);
  });

  it('defines a token block for light and two for dark', () => {
    expect(STYLESHEET.match(TOKEN_BLOCK_PATTERN)).toHaveLength(3);
  });

  it('sizes the icons by class and keeps the theme buttons at the tap size', () => {
    expect(STYLESHEET).toMatch(ICON_RULE_PATTERN);
    expect(STYLESHEET).toMatch(THEME_SWITCH_BUTTON_RULE_PATTERN);
  });

  it('keeps each switcher group on one line so a pill never wraps', () => {
    expect(STYLESHEET).toMatch(SWITCHER_NOWRAP_PATTERN);
  });

  it('lets both switchers fill the header row on a narrow screen', () => {
    const narrowBlock = STYLESHEET.match(NARROW_BLOCK_PATTERN)?.[0];
    expect(narrowBlock).toMatch(/\.theme-switch \{/);
  });

  it('adapts to forced colors', () => {
    expect(STYLESHEET).toMatch(FORCED_COLORS_PATTERN);
  });

  it('turns every animation and transition off under reduced motion', () => {
    expect(STYLESHEET).toMatch(REDUCED_MOTION_GUARD_PATTERN);
  });

  it('never loops an animation or smooth-scrolls', () => {
    expect(STYLESHEET).not.toMatch(INFINITE_ANIMATION_PATTERN);
    expect(STYLESHEET).not.toMatch(SMOOTH_SCROLL_PATTERN);
  });

  it('draws the hero card border from the gradient token', () => {
    expect(STYLESHEET.match(HERO_CARD_RULE_PATTERN)?.[0]).toContain('var(--gradient-hero-border)');
  });

  it('gives the hero card system colours under forced colors', () => {
    const forcedColorsBlock = STYLESHEET.match(FORCED_COLORS_BLOCK_PATTERN)?.[0];
    expect(forcedColorsBlock).toMatch(/\.hero-card \{[^}]*border-color: CanvasText;[^}]*background: Canvas;/);
  });

  it('never opts out of forced colors', () => {
    expect(STYLESHEET).not.toMatch(FORCED_COLOR_OPT_OUT_PATTERN);
  });

  it('has a rule for every class a view emits', () => {
    const ruleClasses = new Set([...STYLESHEET.matchAll(SELECTOR_CLASS_PATTERN)].map((match) => match[1]!));
    const emittedClasses = [...Object.values(PAGES), ...viewSources({ directory: BACKOFFICE_ROOT }).map(({ source }) => source)].flatMap(
      (markup) => [...markup.matchAll(CLASS_ATTRIBUTE_PATTERN)].flatMap((match) => match[1]!.split(/\s+/)),
    );
    const withoutRule = [...new Set(emittedClasses)].filter((name) => !ruleClasses.has(name) && !STATE_ONLY_CLASSES.includes(name));
    expect(withoutRule).toEqual([]);
  });

  it('ends with the single forced-colors block so its rules win the cascade', () => {
    expect(STYLESHEET.match(/@media \(forced-colors: active\)/g)).toHaveLength(1);
    const linesAfterOpening = STYLESHEET.slice(STYLESHEET.search(FORCED_COLORS_PATTERN)).split('\n').slice(1);
    expect(linesAfterOpening.filter((line) => TOP_LEVEL_LINE_PATTERN.test(line) && line !== BLOCK_END)).toEqual([]);
  });

  it('resets the default fieldset border and styles the legend', () => {
    expect(STYLESHEET).toMatch(FIELDSET_RULE_PATTERN);
    expect(STYLESHEET).toMatch(LEGEND_RULE_PATTERN);
  });
});

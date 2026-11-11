import { HttpStatus, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../src/backoffice/audit/backoffice-audit-action';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { MetricsPage } from '../../src/backoffice/metrics/metrics-page';
import { NumberDetailPage } from '../../src/backoffice/numbers/views/number-detail';
import { NumbersListPage } from '../../src/backoffice/numbers/views/numbers-list';
import { AuditPage } from '../../src/backoffice/views/audit';
import { ErrorPage } from '../../src/backoffice/views/error-page';
import { HomePage } from '../../src/backoffice/views/home';
import { StateBadge } from '../../src/backoffice/numbers/components/state-badge';
import { DATA_REPORT, EMPTY_REPORT, homeOverview, METRICS_FILTER, NOW, numberEntry, PAGE } from './backoffice-page-fixtures';

const PAGE_HEAD_WITH_ACTION_PATTERN = /<div class="page-head"><h1>[^<]+<\/h1><a [^>]*button-primary/;
const PAGE_HEAD_ALONE_PATTERN = /<div class="page-head"><h1>[^<]+<\/h1><\/div>/;
const EMPTY_STATE_PATTERN = /class="[^"]*\bempty-state\b/g;
const PRIMARY_BUTTON_PATTERN = /button-primary/g;
const HEADING_PATTERN = /<h1[^>]*>(.*?)<\/h1>/;
const TAG_PATTERN = /<[^>]+>/g;
const SECTION_SPLIT_PATTERN = /(?=<section class="card)/;
const SPARKLINE_PATTERN = /<svg class="sparkline"/g;
const ARROW_LINK_PATTERN = /<a [^>]*button-arrow/g;
const FIGURE_PATTERN = /<p class="tile-figure">(\d+)<span class="tile-unit">([^<]+)<\/span><\/p>/;
const LIVE_DOT_BEFORE_WORD_PATTERN = /<span class="state-badge state-active"><span class="live-dot" aria-hidden="true"><\/span>/;
const HERO_CARD_PATTERN = /class="card hero-card"/g;
const COUNTS = { pending: 1, active: 2, closed: 3, disabled: 4 };
const NO_COUNTS = { pending: 0, active: 0, closed: 0, disabled: 0 };
const AUDIT_ROW = {
  at: 0,
  action: BackofficeAuditAction.SignOut,
  target_kind: null,
  target_id: null,
  outcome: BackofficeAuditOutcome.Succeeded,
  client_address: null,
};

function detailHtml(input: { state: WhatsAppNumberState; verifiedAt: number | null }): string {
  const entry = numberEntry({ state: input.state, verifiedAt: input.verifiedAt });
  return String(
    NumberDetailPage({
      page: PAGE,
      entry,
      allowedTargets: [WhatsAppNumberState.Closed],
      failure: null,
      selectedState: null,
    }),
  );
}

function headingText(html: string): string {
  return html.match(HEADING_PATTERN)![1]!.replace(TAG_PATTERN, '');
}

describe('page head', () => {
  it('wraps the numbers title and its register action', () => {
    expect(String(NumbersListPage({ page: PAGE, entries: [numberEntry({})] }))).toMatch(PAGE_HEAD_WITH_ACTION_PATTERN);
  });

  it('wraps the audit title', () => {
    expect(String(AuditPage({ page: PAGE, rows: [AUDIT_ROW] }))).toMatch(PAGE_HEAD_ALONE_PATTERN);
  });

  it('wraps the metrics title', () => {
    const html = String(MetricsPage({ page: PAGE, filter: METRICS_FILTER, report: EMPTY_REPORT, now: NOW }));
    expect(html).toMatch(PAGE_HEAD_ALONE_PATTERN);
  });
});

describe('number detail layout', () => {
  it.each([WhatsAppNumberState.Pending, WhatsAppNumberState.Active, WhatsAppNumberState.Disabled])(
    'renders the crumb, the title row and the grid for a %s number',
    (state) => {
      const html = detailHtml({ state, verifiedAt: null });
      expect(html).toContain('<a href="/numbers" class="crumb">');
      expect(html).toMatch(/<div class="title-row"><h1>Brazil<\/h1><span class="state-badge/);
    },
  );

  it('puts the summary before the actions in the grid', () => {
    const html = detailHtml({ state: WhatsAppNumberState.Active, verifiedAt: NOW });
    const positions = [
      'class="detail-grid"',
      'aria-labelledby="summary-title"',
      'class="detail-actions"',
      'aria-labelledby="verify-title"',
    ].map((marker) => html.indexOf(marker));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
  });
});

describe('error page heading', () => {
  it.each(Object.values(OwnerLocale))('keeps the accessible name of the 404 heading in %s', (locale) => {
    const html = String(ErrorPage({ status: HttpStatus.NotFound, locale, environment: null }));
    expect(headingText(html)).toBe(`404 ${BACKOFFICE_COPY[locale][BackofficeCopyKey.Error404Title]}`);
    expect(html).toContain('<span class="error-code">404</span>');
    expect(html).toContain('<span class="error-title">');
  });
});

describe('empty state', () => {
  it('renders one on an empty numbers list with the register action as its only primary button', () => {
    const html = String(NumbersListPage({ page: PAGE, entries: [] }));
    expect(html.match(EMPTY_STATE_PATTERN)).toHaveLength(1);
    expect(html.match(PRIMARY_BUTTON_PATTERN)).toHaveLength(1);
  });

  it('renders one on an empty audit log', () => {
    expect(String(AuditPage({ page: PAGE, rows: [] })).match(EMPTY_STATE_PATTERN)).toHaveLength(1);
  });

  it('renders none when the lists have rows', () => {
    expect(String(NumbersListPage({ page: PAGE, entries: [numberEntry({})] }))).not.toContain('empty-state');
    expect(String(AuditPage({ page: PAGE, rows: [AUDIT_ROW] }))).not.toContain('empty-state');
  });
});

function homeSections(input: { counts: typeof COUNTS }): string[] {
  return String(HomePage({ page: PAGE, overview: homeOverview({ counts: input.counts }) }))
    .split(SECTION_SPLIT_PATTERN)
    .filter((part) => part.startsWith('<section class="card'));
}

describe('home cards', () => {
  it('makes the numbers card the only hero card', () => {
    const [numbers, metrics, audit] = homeSections({ counts: COUNTS });
    expect(numbers).toContain('class="card hero-card"');
    expect(metrics).not.toContain('hero-card');
    expect(audit).not.toContain('hero-card');
  });

  it('shows the sum of the state counts as the figure with its unit', () => {
    const [numbers] = homeSections({ counts: COUNTS });
    const figure = numbers!.match(FIGURE_PATTERN);
    expect(figure?.[1]).toBe('10');
    expect(figure?.[2]).toBe('numbers');
  });

  it('replaces the figure with the warning and the register action when there are no numbers', () => {
    const [numbers] = homeSections({ counts: NO_COUNTS });
    expect(numbers).not.toContain('tile-figure');
    expect(numbers).toContain('notice-warning');
  });

  it.each([COUNTS, NO_COUNTS])('draws one sparkline in each of the three cards', (counts) => {
    const sections = homeSections({ counts });
    expect(sections).toHaveLength(3);
    sections.forEach((section) => expect(section.match(SPARKLINE_PATTERN)).toHaveLength(1));
  });

  it('gives the three links an arrow', () => {
    const html = homeSections({ counts: COUNTS }).join('');
    expect(html.match(ARROW_LINK_PATTERN)).toHaveLength(3);
  });
});

describe('state badge live dot', () => {
  it('puts a live dot before the word of an active number only', () => {
    expect(String(StateBadge({ locale: PAGE.locale, state: WhatsAppNumberState.Active }))).toMatch(LIVE_DOT_BEFORE_WORD_PATTERN);
    [WhatsAppNumberState.Pending, WhatsAppNumberState.Closed, WhatsAppNumberState.Disabled].forEach((state) =>
      expect(String(StateBadge({ locale: PAGE.locale, state }))).not.toContain('live-dot'),
    );
  });
});

describe('number detail hero card and live dot', () => {
  it.each([WhatsAppNumberState.Pending, WhatsAppNumberState.Active, WhatsAppNumberState.Disabled])(
    'makes the summary the only hero card of a %s number',
    (state) => {
      const html = detailHtml({ state, verifiedAt: NOW });
      expect(html.match(HERO_CARD_PATTERN)).toHaveLength(1);
      expect(html).toMatch(/<section class="card hero-card" aria-labelledby="summary-title">/);
    },
  );

  it('shows a live dot for an active number and none for a pending or closed one', () => {
    expect(detailHtml({ state: WhatsAppNumberState.Active, verifiedAt: NOW })).toContain('live-dot');
    expect(detailHtml({ state: WhatsAppNumberState.Pending, verifiedAt: null })).not.toContain('live-dot');
    expect(detailHtml({ state: WhatsAppNumberState.Closed, verifiedAt: NOW })).not.toContain('live-dot');
  });
});

describe('metrics summary tables', () => {
  it('right-align their values with the summary table class', () => {
    const html = String(MetricsPage({ page: PAGE, filter: METRICS_FILTER, report: DATA_REPORT, now: NOW }));
    expect(html).toContain('<table class="data-table summary-table">');
  });
});

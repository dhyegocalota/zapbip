import { HttpStatus, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../src/backoffice/audit/backoffice-audit-action';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { MetricsPage } from '../../src/backoffice/metrics/metrics-page';
import { NumberDetailPage } from '../../src/backoffice/numbers/views/number-detail';
import { NumbersListPage } from '../../src/backoffice/numbers/views/numbers-list';
import { AuditPage } from '../../src/backoffice/views/audit';
import { ErrorPage } from '../../src/backoffice/views/error-page';
import { EMPTY_REPORT, METRICS_FILTER, NOW, numberEntry, PAGE } from './backoffice-page-fixtures';

const PAGE_HEAD_WITH_ACTION_PATTERN = /<div class="page-head"><h1>[^<]+<\/h1><a [^>]*button-primary/;
const PAGE_HEAD_ALONE_PATTERN = /<div class="page-head"><h1>[^<]+<\/h1><\/div>/;
const EMPTY_STATE_PATTERN = /class="[^"]*\bempty-state\b/g;
const PRIMARY_BUTTON_PATTERN = /button-primary/g;
const HEADING_PATTERN = /<h1[^>]*>(.*?)<\/h1>/;
const TAG_PATTERN = /<[^>]+>/g;
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
      siblingLabels: [],
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

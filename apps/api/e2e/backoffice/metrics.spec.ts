import { DAY_MS } from '@zapbip/types';
import type { Page } from '@playwright/test';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { keyedCell, MetricCell } from '../../src/backoffice/metrics/metric-cell';
import { NUMBER_QUERY } from '../../src/backoffice/metrics/metrics-filter';
import { expect, test } from './fixtures';
import { expectChartLabelsClear, expectNoHorizontalScroll } from './support/layout';
import { ALPHA_NUMBER, EXPECTED_ALL, EXPECTED_ALPHA, EXPECTED_BUDGET, pushBudgetOverLimit, seedMetrics } from './support/metrics-seed';
import { copy } from './support/copy';
import { signIn } from './support/sign-in';

const ISO_DAY_LENGTH = 'YYYY-MM-DD'.length;

test.beforeEach(({ page }) => signIn({ page }));

function cell(input: { page: Page; name: string }) {
  return input.page.locator(`[data-cell="${input.name}"]`);
}

async function openMetrics(input: { page: Page }): Promise<void> {
  await input.page
    .getByRole('link', { name: copy({ key: BackofficeCopyKey.NavigationMetrics }), exact: true })
    .first()
    .click();
  await expect(input.page.getByRole('heading', { level: 1, name: copy({ key: BackofficeCopyKey.MetricsTitle }) })).toBeVisible();
}

test('shows the empty state before any account exists', async ({ page }) => {
  await openMetrics({ page });
  await expect(cell({ page, name: MetricCell.Accounts })).toHaveText('0');
  await expect(cell({ page, name: MetricCell.BlockedPhones })).toHaveText('0');
  await expect(page.getByText(copy({ key: BackofficeCopyKey.MetricsNoData }))).toHaveCount(1);
  await expectNoHorizontalScroll({ page });
});

test('shows seeded metrics and filters by number', async ({ page }) => {
  seedMetrics();
  await openMetrics({ page });
  await expect(cell({ page, name: MetricCell.Accounts })).toHaveText(EXPECTED_ALL.accounts);
  await expect(cell({ page, name: MetricCell.AgentsActive })).toHaveText(EXPECTED_ALL.agentsActive);
  await expect(cell({ page, name: MetricCell.MessagesIn })).toHaveText(EXPECTED_ALL.messagesIn);
  await page.getByLabel(copy({ key: BackofficeCopyKey.MetricsFilterNumber }), { exact: true }).selectOption({ label: ALPHA_NUMBER.label });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.MetricsFilterApply }) }).click();
  await expect(page).toHaveURL(new RegExp(`${NUMBER_QUERY}=${ALPHA_NUMBER.id}`));
  await expect(cell({ page, name: MetricCell.Accounts })).toHaveText(EXPECTED_ALPHA.accounts);
  await expect(cell({ page, name: MetricCell.AgentsActive })).toHaveText(EXPECTED_ALPHA.agentsActive);
  await expect(cell({ page, name: MetricCell.MessagesIn })).toHaveText(EXPECTED_ALPHA.messagesIn);
});

test('draws the budget per day against the limit and ignores the number filter', async ({ page }) => {
  seedMetrics();
  await openMetrics({ page });
  const yesterday = new Date(Date.now() - DAY_MS).toISOString().slice(0, ISO_DAY_LENGTH);
  await expect(cell({ page, name: MetricCell.BudgetUsed })).toHaveText(EXPECTED_BUDGET.today);
  await expect(cell({ page, name: keyedCell({ cell: MetricCell.BudgetUsed, key: yesterday }) })).toHaveText(EXPECTED_BUDGET.yesterday);
  await expect(page.locator('#chart-budget-title')).toBeAttached();
  await expect(page.locator('#chart-budget-hatch')).toBeAttached();
  await page.getByLabel(copy({ key: BackofficeCopyKey.MetricsFilterNumber }), { exact: true }).selectOption({ label: ALPHA_NUMBER.label });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.MetricsFilterApply }) }).click();
  await expect(cell({ page, name: keyedCell({ cell: MetricCell.BudgetUsed, key: yesterday }) })).toHaveText(EXPECTED_BUDGET.yesterday);
  await expect(page.getByText(copy({ key: BackofficeCopyKey.MetricsBudgetAccountWide }))).toBeVisible();
});

test('keeps the budget chart labels clear of the bars and of each other with a day over the limit', async ({ page }) => {
  seedMetrics();
  pushBudgetOverLimit();
  await openMetrics({ page });
  const chart = page.locator('svg[aria-labelledby^="chart-budget-title"]');
  await expectChartLabelsClear({
    chart,
    bars: chart.locator('rect.bar'),
    labels: chart.locator('text.chart-reference-label, text.chart-axis-maximum'),
  });
});

test('draws script-free charts with their values in a native table and no horizontal scroll', async ({ page }) => {
  seedMetrics();
  await openMetrics({ page });
  await expect(page.locator('svg[role="img"]').first()).toBeVisible();
  await expect(page.locator('script')).toHaveCount(0);
  await page
    .getByText(copy({ key: BackofficeCopyKey.MetricsShowValues }), { exact: true })
    .first()
    .click();
  await expect(page.locator('details[open] table').first()).toBeVisible();
  await expectNoHorizontalScroll({ page });
});

test('switches the period to seven days', async ({ page }) => {
  seedMetrics();
  await openMetrics({ page });
  await page
    .getByLabel(copy({ key: BackofficeCopyKey.MetricsFilterPeriod }), { exact: true })
    .selectOption({ label: copy({ key: BackofficeCopyKey.MetricsPeriod7 }) });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.MetricsFilterApply }) }).click();
  await expect(page).toHaveURL(/period=7/);
  await expect(cell({ page, name: MetricCell.MessagesIn })).toHaveText(EXPECTED_ALL.messagesIn);
});

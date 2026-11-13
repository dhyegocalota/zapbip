import type { Page } from '@playwright/test';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { boxesOf, expectNoHorizontalScroll, expectSiblingsApart } from './support/layout';
import { ALPHA_NUMBER, seedMetrics } from './support/metrics-seed';
import { connectNumberWithFreshCode, walkNumberOf } from './support/numbers';
import { signIn } from './support/sign-in';

const STICKY_MINIMUM_WIDTH = 640;
const COLOR_SCHEMES = ['light', 'dark'] as const;
const SIGNED_OUT_PATHS = ['/sign-in', '/nowhere'];
const SIGNED_IN_PATHS = ['/', '/numbers', '/numbers/connect', `/numbers/${ALPHA_NUMBER.id}`, '/metrics', '/audit'];
const SIBLING_CONTAINERS = [
  'body > header',
  'main',
  '.card-grid',
  '.figure-grid',
  '.detail-grid',
  '.detail-actions',
  '.page-head',
  '.title-row',
];
const WIDE_VIEWPORT = 1000;
const KPI_TILE_COUNT = 5;
const NARROW_KPI_COLUMNS = 2;
const HEIGHT_TOLERANCE = 1;
const MINIMUM_ACTION_GAP = 16;
const MINIMUM_CARD_GAP = 24;
const LONG_LABEL = 'A number label that is forty eight chars long...';
const ONE_LINE_CELL_HEIGHT = 60;
const HIDDEN_LABEL_SIZE = 2;
const MAXIMUM_CARD_PADDING = 56;
const NAVIGATION_LINK_COUNT = 6;
const DELTA_PATTERN = /a mais|a menos|Igual/;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const NO_ANIMATION = 'none';

function viewportWidthOf(input: { page: Page }): number {
  const viewport = input.page.viewportSize();
  if (viewport === null) throw new Error('the page has no viewport');
  return viewport.width;
}

async function expectNoOverlap(input: { page: Page }): Promise<void> {
  await Promise.all(
    SIBLING_CONTAINERS.map(async (selector) => {
      const containers = await input.page.locator(selector).all();
      await Promise.all(containers.map((container) => expectSiblingsApart({ container })));
    }),
  );
}

function computedOf(input: { page: Page; selector: string; property: 'backgroundColor' | 'stroke' | 'borderTopColor' }): Promise<string> {
  return input.page
    .locator(input.selector)
    .first()
    .evaluate((element, property) => {
      const view = element.ownerDocument.defaultView;
      if (view === null) throw new Error('the element has no window');
      return view.getComputedStyle(element)[property];
    }, input.property);
}

function animationNameOf(input: { page: Page; selector: string; pseudo: string | null }): Promise<string> {
  return input.page
    .locator(input.selector)
    .first()
    .evaluate((element, pseudo) => {
      const view = element.ownerDocument.defaultView;
      if (view === null) throw new Error('the element has no window');
      return view.getComputedStyle(element, pseudo).animationName;
    }, input.pseudo);
}

test.describe('signed out', () => {
  for (const colorScheme of COLOR_SCHEMES) {
    for (const path of SIGNED_OUT_PATHS) {
      test(`${path} fits the width and keeps its boxes apart in ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        await expectNoHorizontalScroll({ page });
        await expectNoOverlap({ page });
      });
    }
  }
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    seedMetrics();
    await signIn({ page });
  });

  for (const colorScheme of COLOR_SCHEMES) {
    for (const path of SIGNED_IN_PATHS) {
      test(`${path} fits the width and keeps its boxes apart in ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        await expectNoHorizontalScroll({ page });
        await expectNoOverlap({ page });
      });
    }
  }

  test('the header sticks to the top on wide screens and scrolls away on narrow ones', async ({ page }) => {
    const width = page.viewportSize()?.width;
    if (width === undefined) throw new Error('the page has no viewport');
    const expectedPosition = width >= STICKY_MINIMUM_WIDTH ? 'sticky' : 'static';
    await page.goto('/audit');
    await expect(page.locator('body > header')).toHaveCSS('position', expectedPosition);
  });

  test('the connect form has no default fieldset border and spaces its two actions', async ({ page }) => {
    await page.goto('/numbers/connect');
    await expect(page.locator('fieldset').first()).toHaveCSS('border-top-width', '0px');
    const [cancel, submit] = await Promise.all([
      page.locator('.form-actions > a').boundingBox(),
      page.locator('.form-actions > button').boundingBox(),
    ]);
    if (cancel === null || submit === null) throw new Error('an action has no box');
    const isStacked = submit.y + submit.height <= cancel.y;
    const gap = isStacked ? cancel.y - (submit.y + submit.height) : submit.x - (cancel.x + cancel.width);
    expect(gap).toBeGreaterThanOrEqual(MINIMUM_ACTION_GAP);
  });

  for (const colorScheme of COLOR_SCHEMES) {
    test(`the navigation keeps its links on one row in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      const boxes = await boxesOf({ locator: page.locator('nav .nav-link') });
      expect(boxes).toHaveLength(NAVIGATION_LINK_COUNT);
      expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1);
      await expectNoHorizontalScroll({ page });
    });
  }

  test('spaces the sparkline of the numbers card from its action and lines the three sparklines up', async ({ page }) => {
    await page.goto('/');
    const [action] = await boxesOf({ locator: page.locator('.hero-card > a.button') });
    const sparklines = await boxesOf({ locator: page.locator('.card-grid svg.sparkline') });
    const [first] = sparklines;
    if (action === undefined || first === undefined) throw new Error('the card has no box');
    expect(first.y - (action.y + action.height)).toBeGreaterThanOrEqual(MINIMUM_CARD_GAP);
    const isOneColumn = new Set(sparklines.map((box) => Math.round(box.x))).size === 1;
    if (isOneColumn) return;
    expect(new Set(sparklines.map((box) => Math.round(box.y + box.height))).size).toBe(1);
  });

  test('draws one sparkline in each of the three home cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main .card-grid > section svg.sparkline')).toHaveCount(3);
    await expect(page.locator('main .card-grid > section.hero-card')).toHaveCount(1);
  });

  test.describe('with forced colors', () => {
    test.use({ forcedColors: 'active' });

    test('the hero card keeps a visible border', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.hero-card').first()).not.toHaveCSS('border-top-color', TRANSPARENT);
      await expect(page.getByRole('heading', { level: 1, name: copy({ key: BackofficeCopyKey.HomeTitle }) })).toBeVisible();
    });

    test('the sparkline, the live dot and the hero border are system colours that differ from the canvas', async ({ page }) => {
      await page.goto('/');
      const canvas = await computedOf({ page, selector: 'body', property: 'backgroundColor' });
      const drawn = await Promise.all([
        computedOf({ page, selector: '.live-dot', property: 'backgroundColor' }),
        computedOf({ page, selector: '.sparkline-line', property: 'stroke' }),
        computedOf({ page, selector: '.hero-card', property: 'borderTopColor' }),
      ]);
      drawn.forEach((colour) => {
        expect(colour).not.toBe(canvas);
        expect(colour).not.toBe(TRANSPARENT);
      });
    });
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the live dot does not animate', async ({ page }) => {
      await page.goto('/');
      expect(await animationNameOf({ page, selector: '.live-dot', pseudo: null })).toBe(NO_ANIMATION);
    });
  });

  test.describe('with motion allowed', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('the live dot pulses', async ({ page }) => {
      await page.goto('/');
      expect(await animationNameOf({ page, selector: '.live-dot', pseudo: null })).not.toBe(NO_ANIMATION);
    });
  });
});

test.describe('the metrics dashboard', () => {
  test.beforeEach(async ({ page }) => {
    seedMetrics();
    await signIn({ page });
    await page.goto('/metrics');
  });

  test('lays the tiles in one row on wide screens and in at most two columns on narrow ones', async ({ page }) => {
    const boxes = await boxesOf({ locator: page.locator('.kpi-grid > .kpi') });
    expect(boxes).toHaveLength(KPI_TILE_COUNT);
    const columns = new Set(boxes.map((box) => Math.round(box.x))).size;
    const rows = new Set(boxes.map((box) => Math.round(box.y))).size;
    const isWide = viewportWidthOf({ page }) >= WIDE_VIEWPORT;
    if (isWide) expect(rows).toBe(1);
    if (!isWide) expect(columns).toBeLessThanOrEqual(NARROW_KPI_COLUMNS);
  });

  test('lays the chart cards in two columns on wide screens and one on narrow ones, equal in height within a row', async ({ page }) => {
    const boxes = await boxesOf({ locator: page.locator('.chart-grid > .card') });
    const columns = new Set(boxes.map((box) => Math.round(box.x))).size;
    const isWide = viewportWidthOf({ page }) >= WIDE_VIEWPORT;
    expect(columns).toBe(isWide ? 2 : 1);
    const filledBoxes = await boxesOf({ locator: page.locator('.chart-grid > .card:not(:has(.empty-inline))') });
    const rowTops = [...new Set(filledBoxes.map((box) => Math.round(box.y)))];
    rowTops.forEach((top) => {
      const heights = filledBoxes.filter((box) => Math.round(box.y) === top).map((box) => box.height);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(HEIGHT_TOLERANCE);
    });
  });

  test('never stretches a card that has an empty section into a void', async ({ page }) => {
    const cards = await page.locator('.chart-grid > .card:has(.empty-inline)').all();
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      const [cardBox] = await boxesOf({ locator: card });
      const [lastBox] = await boxesOf({ locator: card.locator(':scope > :last-child') });
      if (cardBox === undefined || lastBox === undefined) throw new Error('the card has no box');
      expect(cardBox.y + cardBox.height - (lastBox.y + lastBox.height)).toBeLessThanOrEqual(MAXIMUM_CARD_PADDING);
    }
  });

  test('gives the budget chart the full width of the grid', async ({ page }) => {
    const [grid] = await boxesOf({ locator: page.locator('.chart-grid') });
    const [budget] = await boxesOf({ locator: page.locator('.chart-card-wide').first() });
    if (grid === undefined || budget === undefined) throw new Error('the grid has no box');
    expect(Math.abs(budget.width - grid.width)).toBeLessThanOrEqual(HEIGHT_TOLERANCE);
  });

  test('puts a delta sentence and a gradient-filled sparkline in every tile', async ({ page }) => {
    const tiles = page.locator('.kpi-grid > .kpi');
    await expect(tiles.locator('.kpi-delta')).toHaveCount(KPI_TILE_COUNT);
    for (const delta of await tiles.locator('.kpi-delta').all()) await expect(delta).toContainText(DELTA_PATTERN);
    for (const area of await tiles.locator('.sparkline-area').all()) await expect(area).toHaveAttribute('fill', /^url\(#/);
  });
});

test.describe('a long number label', () => {
  test.beforeEach(({ page }) => signIn({ page }));

  test('truncates the label and never wraps the number or the dates', async ({ page }) => {
    expect(LONG_LABEL).toHaveLength(48);
    await connectNumberWithFreshCode({ page, number: { ...walkNumberOf({ index: 1 }), label: LONG_LABEL } });
    await page.goto('/numbers');
    const label = page.locator('.data-table tbody tr a').first();
    await expect(label).toHaveAttribute('title', LONG_LABEL);
    await expect(label).toHaveText(LONG_LABEL);
    expect(await label.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    const cells = await boxesOf({ locator: page.locator('.data-table tbody tr td.cell-nowrap') });
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach((cell) => expect(cell.height).toBeLessThan(ONE_LINE_CELL_HEIGHT));
  });
});

test.describe('the empty list', () => {
  test.beforeEach(({ page }) => signIn({ page }));

  test('shows the empty bubble that does not animate under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/numbers');
    await expect(page.locator('.empty-state')).toHaveCount(1);
    expect(await animationNameOf({ page, selector: '.empty-state', pseudo: '::before' })).toBe(NO_ANIMATION);
  });

  test('shows the empty bubble breathing when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/numbers');
    expect(await animationNameOf({ page, selector: '.empty-state', pseudo: '::before' })).not.toBe(NO_ANIMATION);
  });
});

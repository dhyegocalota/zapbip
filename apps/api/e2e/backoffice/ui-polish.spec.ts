import type { Page } from '@playwright/test';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { expectNoHorizontalScroll, expectSiblingsApart } from './support/layout';
import { ALPHA_NUMBER, seedMetrics } from './support/metrics-seed';
import { signIn } from './support/sign-in';

const STICKY_MINIMUM_WIDTH = 640;
const COLOR_SCHEMES = ['light', 'dark'] as const;
const SIGNED_OUT_PATHS = ['/sign-in', '/nowhere'];
const SIGNED_IN_PATHS = ['/', '/numbers', '/numbers/new', `/numbers/${ALPHA_NUMBER.id}`, '/metrics', '/audit'];
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
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const NO_ANIMATION = 'none';

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

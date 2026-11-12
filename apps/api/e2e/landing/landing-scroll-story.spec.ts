import { expect, test } from './fixtures';

const STORY_COUNT = 6;
const SCROLL_PAUSE_MS = 250;
const STUB_UNSUPPORTED_SCRIPT = `CSS.supports = () => false;`;
const CENTER_SCRIPT = `(element) => element.scrollIntoView({ block: 'center', behavior: 'instant' })`;

async function scrollToCenter(input: { page: import('@playwright/test').Page; selector: string; index: number }) {
  const { page, selector, index } = input;
  await page.locator(selector).nth(index).evaluate(CENTER_SCRIPT);
  await page.waitForTimeout(SCROLL_PAUSE_MS);
}

test('the six differentiators arrive in their final state as each reaches the middle of the screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.why-item')).toHaveCount(STORY_COUNT);
  for (let index = 0; index < STORY_COUNT; index += 1) {
    await scrollToCenter({ page, selector: '.why-item', index });
    const steps = page.locator('.why-item').nth(index).locator('.scene-step');
    const stepCount = await steps.count();
    expect(stepCount).toBeGreaterThan(0);
    for (let step = 0; step < stepCount; step += 1) await expect(steps.nth(step)).toHaveCSS('opacity', '1');
  }
});

test.describe('a browser without scroll timelines', () => {
  test('hides a story until it enters and then shows it for good', async ({ page }) => {
    await page.addInitScript(STUB_UNSUPPORTED_SCRIPT);
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/has-reveal/);
    await expect(page.locator('.why-item').nth(STORY_COUNT - 1)).not.toHaveClass(/is-visible/);
    await scrollToCenter({ page, selector: '.why-item', index: STORY_COUNT - 1 });
    await expect(page.locator('.why-item').nth(STORY_COUNT - 1)).toHaveClass(/is-visible/);
    await page.evaluate(`window.scrollTo(0, 0)`);
    await expect(page.locator('.why-item').nth(STORY_COUNT - 1)).toHaveClass(/is-visible/);
  });

  test('leaves no revealed block hidden after a full scroll', async ({ page }) => {
    await page.addInitScript(STUB_UNSUPPORTED_SCRIPT);
    await page.goto('/');
    const revealCount = await page.locator('.reveal').count();
    for (let index = 0; index < revealCount; index += 1) await page.locator('.reveal').nth(index).evaluate(CENTER_SCRIPT);
    await expect(page.locator('.reveal:not(.is-visible)')).toHaveCount(0);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows every story and every block in its final state with nothing moving', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/has-reveal/);
    const steps = page.locator('.scene-step');
    const stepCount = await steps.count();
    for (let index = 0; index < stepCount; index += 1) await expect(steps.nth(index)).toHaveCSS('opacity', '1');
    const reveals = page.locator('.reveal');
    const revealCount = await reveals.count();
    for (let index = 0; index < revealCount; index += 1) await expect(reveals.nth(index)).toHaveCSS('opacity', '1');
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
  });
});

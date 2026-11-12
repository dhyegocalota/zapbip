import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const STORY_COUNT = 6;
const STORY_SELECTOR = '.why-item';
const REVEAL_SELECTOR = '.reveal';
const SETTLED_RATIO = 0.3;
const SCROLL_PAUSE_MS = 250;
const FRAME_PAUSE_MS = 60;
const STUB_UNSUPPORTED_SCRIPT = 'CSS.supports = () => false;';

function elementScript(input: { selector: string; index: number; action: string }): string {
  return `(() => { const element = document.querySelectorAll('${input.selector}')[${input.index}]; ${input.action} })()`;
}

async function scrollThrough(input: { page: Page; index: number }): Promise<void> {
  const action = `window.scrollTo(0, element.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * ${SETTLED_RATIO});`;
  await input.page.evaluate(elementScript({ selector: STORY_SELECTOR, index: input.index, action }));
  await input.page.waitForTimeout(SCROLL_PAUSE_MS);
}

async function scrollToCenter(input: { page: Page; selector: string; index: number }): Promise<void> {
  const action = `element.scrollIntoView({ block: 'center', behavior: 'instant' });`;
  await input.page.evaluate(elementScript({ selector: input.selector, index: input.index, action }));
  await input.page.waitForTimeout(FRAME_PAUSE_MS);
}

async function expectFullyShown(input: { targets: Locator }): Promise<void> {
  const count = await input.targets.count();
  expect(count).toBeGreaterThan(0);
  await Promise.all(Array.from({ length: count }, (_value, index) => expect(input.targets.nth(index)).toHaveCSS('opacity', '1')));
}

test('the six differentiators arrive in their final state as each one is scrolled through', async ({ page }) => {
  await page.goto('/');
  const stories = page.locator(STORY_SELECTOR);
  await expect(stories).toHaveCount(STORY_COUNT);
  for (let index = 0; index < STORY_COUNT; index += 1) {
    await scrollThrough({ page, index });
    await expectFullyShown({ targets: stories.nth(index).locator('.scene-step') });
  }
});

test.describe('a browser without scroll timelines', () => {
  test('hides a story until it enters and then shows it for good', async ({ page }) => {
    await page.addInitScript(STUB_UNSUPPORTED_SCRIPT);
    await page.goto('/');
    const lastStory = page.locator(STORY_SELECTOR).nth(STORY_COUNT - 1);
    await expect(page.locator('html')).toHaveClass(/has-reveal/);
    await expect(lastStory).not.toHaveClass(/is-visible/);
    await scrollToCenter({ page, selector: STORY_SELECTOR, index: STORY_COUNT - 1 });
    await page.waitForTimeout(SCROLL_PAUSE_MS);
    await expect(lastStory).toHaveClass(/is-visible/);
    await expectFullyShown({ targets: lastStory.locator('.scene-step') });
    await page.evaluate('window.scrollTo(0, 0)');
    await expect(lastStory).toHaveClass(/is-visible/);
  });

  test('leaves no revealed block hidden after a full scroll', async ({ page }) => {
    await page.addInitScript(STUB_UNSUPPORTED_SCRIPT);
    await page.goto('/');
    const reveals = page.locator(REVEAL_SELECTOR);
    const revealCount = await reveals.count();
    for (let index = 0; index < revealCount; index += 1) await scrollToCenter({ page, selector: REVEAL_SELECTOR, index });
    await expect(page.locator(`${REVEAL_SELECTOR}:not(.is-visible)`)).toHaveCount(0);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows every story and every block in its final state with nothing moving', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/has-reveal/);
    await expectFullyShown({ targets: page.locator('.scene-step') });
    await expectFullyShown({ targets: page.locator(REVEAL_SELECTOR) });
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
  });
});

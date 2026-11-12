import { expect, test } from './fixtures';

const RUNNING_ANIMATIONS_SCRIPT = 'document.getAnimations().length';

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the poster, never plays the video and runs no animation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.demo-poster')).toBeVisible();
    await page.waitForLoadState('load');
    await expect(page.locator('.demo-video')).toHaveJSProperty('paused', true);
    await expect(page.locator('.demo-toggle')).toBeHidden();
    expect(await page.evaluate(RUNNING_ANIMATIONS_SCRIPT)).toBe(0);
  });
});

test('the default motion plays the muted loop once the hero is in view', async ({ page }) => {
  await page.goto('/');
  const video = page.locator('.demo-video');
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('loop', true);
  await expect(video).toHaveAttribute('playsinline', '');
  await expect(video).toHaveClass(/is-playing/);
  await expect(video).toHaveJSProperty('paused', false);
  await page.locator('.demo-toggle').click();
  await expect(video).toHaveJSProperty('paused', true);
});

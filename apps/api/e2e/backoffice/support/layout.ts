import { expect, type Page } from '@playwright/test';

export async function expectNoHorizontalScroll(input: { page: Page }): Promise<void> {
  const viewport = input.page.viewportSize();
  if (viewport === null) throw new Error('the page has no viewport');
  const scrollWidth = await input.page.locator('html').evaluate((element) => element.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
}

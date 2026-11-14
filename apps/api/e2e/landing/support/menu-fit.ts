import { expect, type Page } from '@playwright/test';
import { MENU_LOCALES } from '../../../src/web-shell/locale-profiles';

export type MenuFitViewport = { name: string; width: number; height: number; columns: number };

export const MENU_FIT_VIEWPORTS: MenuFitViewport[] = [
  { name: 'short phone', width: 375, height: 560, columns: 2 },
  { name: 'landscape phone', width: 740, height: 360, columns: 2 },
  { name: 'desktop', width: 1440, height: 900, columns: 1 },
  { name: 'very short', width: 740, height: 260, columns: 2 },
];

const SCROLL_TO_END_SCRIPT = 'window.scrollTo(0, document.documentElement.scrollHeight)';
const EDGE_TOLERANCE = 1;

type Box = { x: number; y: number; width: number; height: number };
type MenuFitInput = { page: Page; path: string; footer: string; viewport: MenuFitViewport };

function isInside(input: { inner: Box; outer: Box }): boolean {
  const { inner, outer } = input;
  const isInsideAcross = inner.x >= outer.x - EDGE_TOLERANCE && inner.x + inner.width <= outer.x + outer.width + EDGE_TOLERANCE;
  const isInsideDown = inner.y >= outer.y - EDGE_TOLERANCE && inner.y + inner.height <= outer.y + outer.height + EDGE_TOLERANCE;
  return isInsideAcross && isInsideDown;
}

function screenOf(input: { viewport: MenuFitViewport }): Box {
  return { x: 0, y: 0, width: input.viewport.width, height: input.viewport.height };
}

async function openFooterMenu(input: MenuFitInput): Promise<void> {
  const { page, path, footer, viewport } = input;
  const list = page.locator(`${footer} .lang-list`);
  await page.goto(path);
  await page.evaluate(SCROLL_TO_END_SCRIPT);
  await page.locator(`${footer} .lang-trigger`).click();
  await expect(list).toBeVisible();
  await expect.poll(async () => isInside({ inner: (await list.boundingBox())!, outer: screenOf({ viewport }) })).toBe(true);
}

export async function expectOpenMenuInsideScreen(input: MenuFitInput) {
  const { page, footer, viewport } = input;
  await openFooterMenu(input);
  const options = page.locator(`${footer} .lang-option`);
  const first = (await options.first().boundingBox())!;
  const second = (await options.nth(1).boundingBox())!;
  const sharesFirstRow = Math.abs(first.y - second.y) <= EDGE_TOLERANCE;
  expect(sharesFirstRow).toBe(viewport.columns === 2);
}

export async function expectEveryOptionReachedInsideMenu(input: MenuFitInput) {
  const { page, footer, viewport } = input;
  await openFooterMenu(input);
  for (const locale of MENU_LOCALES) {
    await page.keyboard.press('Tab');
    const focused = page.locator(`${footer} .lang-option:focus`);
    await expect(focused).toHaveAttribute('value', locale);
    const option = (await focused.boundingBox())!;
    const list = (await page.locator(`${footer} .lang-list`).boundingBox())!;
    expect(isInside({ inner: option, outer: list })).toBe(true);
    expect(isInside({ inner: list, outer: screenOf({ viewport }) })).toBe(true);
  }
}

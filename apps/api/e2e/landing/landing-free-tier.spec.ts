import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../../src/site/site-copy';
import { expect, test } from './fixtures';
import { siteCopy } from './support/site-copy';

const FIRST_AGENT = Object.entries(AGENT_INSTALLS)[0]!;
const [FIRST_AGENT_ID, FIRST_AGENT_INSTALL] = FIRST_AGENT;
const REFERRAL_CODE = 'abcdefgh2345';
const DESKTOP_WIDTH = 1024;
const PHONE_COLUMNS = 2;
const DESKTOP_COLUMNS = 4;
const MAXIMUM_TILE_GRID_HEIGHT = 800;
const PRO_HEIGHT_RATIO = 0.6;
const MINIMUM_TOUCH_TARGET = 44;

async function expectPicking(input: { page: import('@playwright/test').Page; locale: OwnerLocale }) {
  const { page, locale } = input;
  const agent = FIRST_AGENT_INSTALL.productName;
  await page.getByRole('link', { name: siteCopy({ key: SiteCopyKey.AgentCardButton, locale, values: { agent } }) }).click();
  await expect(page.locator('#join-email')).toBeFocused();
  await expect(page.locator('.join-agent')).toHaveText(siteCopy({ key: SiteCopyKey.AgentCardPicked, locale, values: { agent } }));
  await expect(page.locator('.join-agent')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`agent=${FIRST_AGENT_ID}`));
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
}

test('an agent card takes you to the form and remembers the agent in en_US', async ({ page }) => {
  await page.goto('/');
  await expectPicking({ page, locale: OwnerLocale.EnglishUs });
});

test.describe('pt-BR browser', () => {
  test.use({ locale: 'pt-BR' });

  test('an agent card takes you to the form and remembers the agent in pt_BR', async ({ page }) => {
    await page.goto('/');
    await expectPicking({ page, locale: OwnerLocale.PortugueseBrazil });
  });
});

test('the hint survives a reload and keeps the referral code', async ({ page }) => {
  await page.goto(`/?ref=${REFERRAL_CODE}`);
  await page
    .getByRole('link', { name: siteCopy({ key: SiteCopyKey.AgentCardButton, values: { agent: FIRST_AGENT_INSTALL.productName } }) })
    .click();
  await page.reload();
  await expect(page.locator('.join-agent')).toBeVisible();
  await expect(page.locator('input[name="referralCode"]')).toHaveValue(REFERRAL_CODE);
});

test('an unknown agent in the address shows no hint', async ({ page }) => {
  await page.goto('/?agent=nope');
  await expect(page.locator('.join-agent')).toBeHidden();
  await expect(page.locator('#join-email')).toBeVisible();
});

test('the pricing offers the free plan and sends its button to the form', async ({ page }) => {
  await page.goto('/');
  const pricing = page.locator('#pricing');
  await expect(pricing.locator('.plan-free')).toContainText(siteCopy({ key: SiteCopyKey.PricingFreePrice }));
  await expect(pricing.locator('.plan-pro')).toContainText(siteCopy({ key: SiteCopyKey.PricingProName }));
  await pricing.getByRole('link', { name: siteCopy({ key: SiteCopyKey.PricingCta }) }).click();
  await expect(page.locator('#join-email')).toBeFocused();
});

test('the free question opens in the FAQ', async ({ page }) => {
  await page.goto('/');
  await page.getByText(siteCopy({ key: SiteCopyKey.FaqFreeQuestion })).click();
  await expect(page.getByText(siteCopy({ key: SiteCopyKey.FaqFreeAnswer }))).toBeVisible();
});

test('the agent tiles stay compact: two columns on a phone, four on a desktop', async ({ page }) => {
  await page.goto('/');
  const tiles = page.locator('.clients .agent-card');
  const count = await tiles.count();
  const boxes = await Promise.all(Array.from({ length: count }, (_value, index) => tiles.nth(index).boundingBox()));
  const columns = new Set(boxes.map((box) => Math.round(box!.x))).size;
  const viewportWidth = page.viewportSize()!.width;
  expect(columns).toBe(viewportWidth < DESKTOP_WIDTH ? PHONE_COLUMNS : DESKTOP_COLUMNS);
  const gridBox = (await page.locator('.clients').boundingBox())!;
  expect(gridBox.height).toBeLessThan(MAXIMUM_TILE_GRID_HEIGHT);
});

test('the Pro card does not stretch to the height of the Free card', async ({ page }) => {
  await page.goto('/');
  const free = (await page.locator('.plan-free').boundingBox())!;
  const pro = (await page.locator('.plan-pro').boundingBox())!;
  expect(pro.height).toBeLessThan(free.height * PRO_HEIGHT_RATIO);
});

test('the tile links line up across a row and are easy to tap', async ({ page }) => {
  await page.goto('/');
  const tiles = page.locator('.clients .agent-card');
  const count = await tiles.count();
  const links = await Promise.all(
    Array.from({ length: count }, async (_value, index) => ({
      tile: (await tiles.nth(index).boundingBox())!,
      link: (await tiles.nth(index).locator('.agent-pick, .button').boundingBox())!,
    })),
  );
  const rowKeys = [...new Set(links.map((entry) => Math.round(entry.tile.y)))];
  const misaligned = rowKeys.filter((key) => {
    const positions = links.filter((entry) => Math.round(entry.tile.y) === key).map((entry) => Math.round(entry.link.y));
    return new Set(positions).size > 1;
  });
  expect(misaligned).toEqual([]);
  expect(links.filter((entry) => entry.link.height < MINIMUM_TOUCH_TARGET)).toEqual([]);
});

test('the decoration of the final call stays inside its rounded corner', async ({ page }) => {
  await page.goto('/');
  const offsets = await page.evaluate(
    `(() => { const style = getComputedStyle(document.querySelector('.final'), '::after'); return [parseFloat(style.top), parseFloat(style.right)]; })()`,
  );
  expect((offsets as number[]).filter((offset) => offset < 0)).toEqual([]);
});

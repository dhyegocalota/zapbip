import type { Page } from '@playwright/test';
import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../../src/site/site-copy';
import { expect, test } from './fixtures';
import { siteCopy } from './support/site-copy';

const AGENTS = Object.entries(AGENT_INSTALLS).map(([id, install]) => ({ id, name: install.productName, install }));
const [FIRST_AGENT, SECOND_AGENT, THIRD_AGENT] = AGENTS as [(typeof AGENTS)[number], (typeof AGENTS)[number], (typeof AGENTS)[number]];
const REFERRAL_CODE = 'abcdefgh2345';
const MOBILE_WIDTH = 375;
const MINIMUM_TAB_HEIGHT = 44;
const GRANTED_PERMISSIONS = ['clipboard-read', 'clipboard-write'];

function tabOf(input: { page: Page; id: string }) {
  return input.page.locator(`#start-tab-${input.id}`);
}

function visiblePanelsOf(input: { page: Page }) {
  return input.page.locator('.start-panel:not([hidden])');
}

async function expectSelected(input: { page: Page; id: string }): Promise<void> {
  await expect(tabOf(input)).toHaveAttribute('aria-selected', 'true');
  await expect(visiblePanelsOf(input)).toHaveCount(1);
  await expect(input.page.locator(`#start-panel-${input.id}`)).toBeVisible();
}

test('a click on a tab shows its panel at once, keeps the language and the referral code, and rewrites the address', async ({ page }) => {
  await page.goto(`/?lang=en&ref=${REFERRAL_CODE}`);
  await expectSelected({ page, id: FIRST_AGENT.id });
  const before = page.url();
  await tabOf({ page, id: SECOND_AGENT.id }).click();
  await expectSelected({ page, id: SECOND_AGENT.id });
  await expect(page).toHaveURL(new RegExp(`agent=${SECOND_AGENT.id}`));
  await expect(page).toHaveURL(/lang=en/);
  await expect(page).toHaveURL(new RegExp(`ref=${REFERRAL_CODE}`));
  expect(page.url()).not.toBe(before);
  await expect(page.locator('.join-agent')).toHaveText(
    siteCopy({ key: SiteCopyKey.AgentCardPicked, values: { agent: SECOND_AGENT.name } }),
  );
});

test('the any app tab clears the picked agent', async ({ page }) => {
  await page.goto(`/?agent=${FIRST_AGENT.id}`);
  await tabOf({ page, id: 'any' }).click();
  await expectSelected({ page, id: 'any' });
  await expect(page.locator('.join-agent')).toBeHidden();
  await expect(page).toHaveURL(/agent=any/);
});

test('arrow keys, Home and End move between the tabs and the focus follows', async ({ page }) => {
  await page.goto('/');
  await tabOf({ page, id: FIRST_AGENT.id }).focus();
  await page.keyboard.press('ArrowRight');
  await expectSelected({ page, id: SECOND_AGENT.id });
  await expect(tabOf({ page, id: SECOND_AGENT.id })).toBeFocused();
  await page.keyboard.press('End');
  await expectSelected({ page, id: 'any' });
  await page.keyboard.press('ArrowRight');
  await expectSelected({ page, id: FIRST_AGENT.id });
  await page.keyboard.press('ArrowLeft');
  await expectSelected({ page, id: 'any' });
  await page.keyboard.press('Home');
  await expectSelected({ page, id: FIRST_AGENT.id });
  await expect(tabOf({ page, id: SECOND_AGENT.id })).toHaveAttribute('tabindex', '-1');
});

test('only the selected tab is a tab stop once the script runs', async ({ page }) => {
  await page.goto('/');
  await expect(tabOf({ page, id: FIRST_AGENT.id })).toHaveAttribute('tabindex', '0');
  await expect(tabOf({ page, id: THIRD_AGENT.id })).toHaveAttribute('tabindex', '-1');
});

test('the tabs are tall enough to tap', async ({ page }) => {
  await page.goto('/');
  const heights = await Promise.all(AGENTS.map(async (agent) => (await tabOf({ page, id: agent.id }).boundingBox())!.height));
  expect(heights.filter((height) => height < MINIMUM_TAB_HEIGHT)).toEqual([]);
});

test.describe('with the clipboard', () => {
  test.use({ permissions: GRANTED_PERMISSIONS });

  test('the copy button writes the code, says so and resets', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator(`#start-panel-${FIRST_AGENT.id}`);
    await panel.scrollIntoViewIfNeeded();
    const code = (await panel.locator('code').innerText()).trim();
    await panel.locator('.start-copy').click();
    expect(await page.evaluate('navigator.clipboard.readText()')).toBe(code);
    await expect(panel.locator('.start-copy')).toHaveText(siteCopy({ key: SiteCopyKey.StartCopied }));
    await expect(page.locator('#start-announcement')).toHaveText(siteCopy({ key: SiteCopyKey.StartCopiedAnnouncement }));
    await expect(panel.locator('.start-copy')).toHaveText(siteCopy({ key: SiteCopyKey.StartCopy }));
  });
});

test('the call to action goes to the form and carries the agent', async ({ page }) => {
  await page.goto('/');
  await page.locator(`#start-panel-${FIRST_AGENT.id} .start-cta`).click();
  await expect(page.locator('#join-email')).toBeFocused();
  await expect(page.locator('.join-agent')).toHaveText(siteCopy({ key: SiteCopyKey.AgentCardPicked, values: { agent: FIRST_AGENT.name } }));
  await expect(page).toHaveURL(new RegExp(`agent=${FIRST_AGENT.id}`));
});

test.describe('pt-BR browser', () => {
  test.use({ locale: 'pt-BR' });

  test('the section speaks Portuguese and keeps the language on a switch', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#start')).toContainText(siteCopy({ key: SiteCopyKey.StartTitle, locale: OwnerLocale.PortugueseBrazil }));
    await tabOf({ page, id: SECOND_AGENT.id }).click();
    await expect(page).toHaveURL(/lang=pt-BR/);
    await expect(page.locator(`#start-panel-${SECOND_AGENT.id} .start-copy`)).toHaveText(
      siteCopy({ key: SiteCopyKey.StartCopy, locale: OwnerLocale.PortugueseBrazil }),
    );
  });
});

test.describe('no script', () => {
  test.use({ javaScriptEnabled: false });

  test('a tab is a link that loads the page with its panel', async ({ page }) => {
    await page.goto('/');
    await tabOf({ page, id: SECOND_AGENT.id }).click();
    await expectSelected({ page, id: SECOND_AGENT.id });
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the panel with no animation running', async ({ page }) => {
    await page.goto('/');
    await expectSelected({ page, id: FIRST_AGENT.id });
    await tabOf({ page, id: SECOND_AGENT.id }).click();
    await expectSelected({ page, id: SECOND_AGENT.id });
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
  });
});

test.describe('375 px', () => {
  test.use({ viewport: { width: MOBILE_WIDTH, height: 812 } });

  test('the tab row scrolls inside itself and the page does not', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(MOBILE_WIDTH);
    const tablist = page.locator('.start-tabs');
    expect(await tablist.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await tabOf({ page, id: 'any' }).focus();
    await expect(tabOf({ page, id: 'any' })).toBeInViewport();
  });

  test('the selected tab is scrolled into view when the page loads on a later agent', async ({ page }) => {
    await page.goto('/?agent=any');
    await expect(tabOf({ page, id: 'any' })).toBeInViewport({ ratio: 1 });
  });
});

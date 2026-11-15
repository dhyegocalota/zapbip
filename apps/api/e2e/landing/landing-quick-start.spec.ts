import type { Page } from '@playwright/test';
import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { OwnerLocale } from '@zapbip/types';
import { SITE_EXAMPLE_CONNECTION_LINK } from '../../src/site/site-constants';
import { SiteCopyKey } from '../../src/site/site-copy';
import { expect, test } from './fixtures';
import { siteCopy } from './support/site-copy';

const AGENTS = Object.entries(AGENT_INSTALLS).map(([id, install]) => ({ id, name: install.productName, install }));
const [FIRST_AGENT, SECOND_AGENT, THIRD_AGENT] = AGENTS as [(typeof AGENTS)[number], (typeof AGENTS)[number], (typeof AGENTS)[number]];
const REFERRAL_CODE = 'abcdefgh2345';
const MOBILE_WIDTH = 375;
const MINIMUM_TAB_HEIGHT = 44;
const GRANTED_PERMISSIONS = ['clipboard-read', 'clipboard-write'];
const DESKTOP_WIDTH = 1280;
const MAXIMUM_CARET_BLINKS = 5;
const MAXIMUM_TOKEN_LINES = 1.5;
const FULL_WIDTH_RATIO = 0.9;
const TAB_ROW_PADDING = 4;
const SETUP_PATH = '/setup.md';

async function computedStyleOf(input: { page: Page; selector: string; pseudo: string | null; property: string }): Promise<string> {
  const pseudo = input.pseudo === null ? 'null' : `'${input.pseudo}'`;
  return input.page.evaluate(`getComputedStyle(document.querySelector('${input.selector}'), ${pseudo}).${input.property}`);
}

function promptOf(input: { page: Page }): string {
  return siteCopy({ key: SiteCopyKey.StartPromptLine, values: { setupUrl: `${new URL(input.page.url()).origin}${SETUP_PATH}` } });
}

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
  await page.goto(`/?ref=${REFERRAL_CODE}`);
  await expectSelected({ page, id: FIRST_AGENT.id });
  const before = page.url();
  await tabOf({ page, id: SECOND_AGENT.id }).click();
  await expectSelected({ page, id: SECOND_AGENT.id });
  await expect(page).toHaveURL(new RegExp(`agent=${SECOND_AGENT.id}`));
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page).toHaveURL(new RegExp(`ref=${REFERRAL_CODE}`));
  expect(page.url()).not.toBe(before);
  await expect(page.locator('.join-agent')).toBeHidden();
});

test('the any app tab clears the picked agent', async ({ page }) => {
  await page.goto(`/?agent=${FIRST_AGENT.id}`);
  await tabOf({ page, id: 'any' }).click();
  await expectSelected({ page, id: 'any' });
  await expect(page).toHaveURL(/agent=any/);
});

test.describe('browsing without smooth scrolling', () => {
  test.use({ reducedMotion: 'reduce' });

  test('browsing the tabs never announces a pick; the call to action does, and the any app one clears it', async ({ page }) => {
    await page.goto('/');
    await tabOf({ page, id: SECOND_AGENT.id }).click();
    await tabOf({ page, id: THIRD_AGENT.id }).click();
    await expect(page.locator('.join-agent')).toBeHidden();
    await page.locator(`#start-panel-${THIRD_AGENT.id} .start-cta`).click();
    await expect(page.locator('.join-agent')).toHaveText(
      siteCopy({ key: SiteCopyKey.AgentCardPicked, values: { agent: THIRD_AGENT.name } }),
    );
    await tabOf({ page, id: 'any' }).click();
    await page.locator('#start-panel-any .start-cta').click();
    await expect(page.locator('.join-agent')).toBeHidden();
  });
});

test.describe('without a clipboard', () => {
  test('the code is selected whole and the fallback is announced', async ({ page }) => {
    await page.addInitScript("Object.defineProperty(navigator, 'clipboard', { value: undefined });");
    await page.goto('/');
    const panel = page.locator(`#start-panel-${FIRST_AGENT.id}`);
    await panel.scrollIntoViewIfNeeded();
    await panel.locator('.start-copy').click();
    const expected = (await panel.locator('code').first().textContent())!;
    const selection = (await page.evaluate('window.getSelection().toString()')) as string;
    expect(selection.replaceAll(/\s+/g, ' ').trim()).toBe(expected.replaceAll(/\s+/g, ' ').trim());
    await expect(page.locator('#start-announcement')).toHaveText(siteCopy({ key: SiteCopyKey.StartCopyFallback }));
  });
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
    const code = (await panel.locator('code').first().innerText()).trim();
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
    await expect(page).toHaveURL(/\/pt-br\?agent=/);
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
    const tab = (await tabOf({ page, id: 'any' }).boundingBox())!;
    const list = (await page.locator('.start-tabs').boundingBox())!;
    expect(tab.x).toBeGreaterThanOrEqual(list.x);
    expect(tab.x + tab.width).toBeLessThanOrEqual(list.x + list.width);
  });
});

test.describe('1280 px', () => {
  test.use({ viewport: { width: DESKTOP_WIDTH, height: 900 } });

  test('the panel and the tabs fill the width of the section, in balanced rows', async ({ page }) => {
    await page.goto('/');
    const container = (await page.locator('#start .container').boundingBox())!;
    const panel = (await page.locator('.start-panel:not([hidden])').boundingBox())!;
    const tabs = (await page.locator('.start-tabs').boundingBox())!;
    const title = (await page.locator('#start-title').boundingBox())!;
    expect(Math.abs(panel.x - title.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(panel.width - tabs.width)).toBeLessThanOrEqual(1);
    expect(panel.width).toBeGreaterThan(container.width * FULL_WIDTH_RATIO);
    const boxes = await Promise.all(
      [...AGENTS.map((agent) => agent.id), 'any'].map(async (id) => (await tabOf({ page, id }).boundingBox())!),
    );
    const rows = new Set(boxes.map((box) => Math.round(box.y)));
    expect(rows.size).toBe(2);
    const lastRow = boxes.filter((box) => Math.round(box.y) === Math.max(...rows));
    const rightEdge = Math.max(...lastRow.map((box) => box.x + box.width));
    expect(rightEdge).toBeGreaterThanOrEqual(tabs.x + tabs.width - TAB_ROW_PADDING - 1);
  });
});

test.describe('375 px header, fade and click path', () => {
  test.use({ viewport: { width: MOBILE_WIDTH, height: 812 } });

  test('the header keeps words whole and shows no dots', async ({ page }) => {
    await page.goto(
      `/?agent=${AGENTS.find((agent) => agent.install.quickStart({ locale: OwnerLocale.EnglishUs, connectionLink: 'x' }).code.includes('\n'))!.id}`,
    );
    const hintWrap = await computedStyleOf({
      page,
      selector: '.start-panel:not([hidden]) .code-hint',
      pseudo: null,
      property: 'overflowWrap',
    });
    expect(hintWrap).toBe('normal');
    const dots = await computedStyleOf({ page, selector: '.start-panel:not([hidden]) .code-bar', pseudo: '::before', property: 'display' });
    expect(dots).toBe('none');
  });

  test('the tab row fades at its scrollable edge and not on a wide screen', async ({ page }) => {
    await page.goto('/');
    expect(await computedStyleOf({ page, selector: '.start-tabs', pseudo: null, property: 'maskImage' })).toContain('linear-gradient');
    await page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 });
    expect(await computedStyleOf({ page, selector: '.start-tabs', pseudo: null, property: 'maskImage' })).toBe('none');
  });
});

test('a UI path agent shows its click path as numbered steps above the address', async ({ page }) => {
  const addressOnly = AGENTS.find(
    (agent) => agent.install.quickStart({ locale: OwnerLocale.EnglishUs, connectionLink: 'x' }).path.length > 0,
  )!;
  await page.goto(`/?agent=${addressOnly.id}`);
  const steps = page.locator('.start-panel:not([hidden]) .code-path li');
  const expected = addressOnly.install.quickStart({ locale: OwnerLocale.EnglishUs, connectionLink: 'x' }).path;
  await expect(steps).toHaveText(expected);
  await expect(page.locator('.start-panel:not([hidden]) .start-manual code')).toContainText(SITE_EXAMPLE_CONNECTION_LINK);
});

test.describe('typing in', () => {
  test('types the command on a tab switch while the page text is already complete', async ({ page }) => {
    await page.goto('/');
    await page.locator('#start').scrollIntoViewIfNeeded();
    await expect(page.locator('#start')).toHaveClass(/is-live/);
    await tabOf({ page, id: SECOND_AGENT.id }).click();
    const typing = await page.evaluate("document.getAnimations().some((animation) => animation.animationName === 'code-type')");
    expect(typing).toBe(true);
    const expected = promptOf({ page });
    const promptCode = page.locator(`#start-panel-${SECOND_AGENT.id} code`).first();
    expect(await promptCode.textContent()).toBe(expected);
    expect(await promptCode.textContent()).toContain(expected);
    await expect
      .poll(() =>
        page.evaluate(
          "document.getAnimations().filter((animation) => animation.animationName === 'code-type').every((animation) => animation.playState === 'finished')",
        ),
      )
      .toBe(true);
  });

  test('copies the whole command at once, even while it types', async ({ page, context }) => {
    await context.grantPermissions(GRANTED_PERMISSIONS);
    await page.goto('/');
    await page.locator('#start').scrollIntoViewIfNeeded();
    await tabOf({ page, id: SECOND_AGENT.id }).click();
    await page.locator(`#start-panel-${SECOND_AGENT.id} .start-copy`).click();
    expect(await page.evaluate('navigator.clipboard.readText()')).toBe(promptOf({ page }));
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows the text at once with no caret', async ({ page }) => {
      await page.goto('/');
      await page.locator('#start').scrollIntoViewIfNeeded();
      const caret = await computedStyleOf({
        page,
        selector: '.start-panel:not([hidden]) .code-line:last-child',
        pseudo: '::after',
        property: 'content',
      });
      expect(caret === 'none' || caret === 'normal').toBe(true);
      expect(await page.evaluate('document.getAnimations().length')).toBe(0);
    });
  });
});

test.describe('the typed command and its caret', () => {
  test('stays hidden until the block is live, then blinks a few times only', async ({ page }) => {
    await page.goto('/');
    const before = await computedStyleOf({ page, selector: '.start-panel:not([hidden]) .code-line', pseudo: null, property: 'clipPath' });
    expect(before).toContain('100%');
    await page.locator('#start').scrollIntoViewIfNeeded();
    await expect(page.locator('#start')).toHaveClass(/is-live/);
    const iterations = await computedStyleOf({
      page,
      selector: '.start-panel:not([hidden]) .code-line:last-child',
      pseudo: '::after',
      property: 'animationIterationCount',
    });
    expect(Number(iterations)).toBeLessThanOrEqual(MAXIMUM_CARET_BLINKS);
  });
});

test.describe('no script, the copy button', () => {
  test.use({ javaScriptEnabled: false });

  test('is not offered', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.start-copy')).toHaveCount(AGENTS.length + 1);
    await expect(page.locator('.start-copy:visible')).toHaveCount(0);
  });
});

test('with a script, the copy button of the visible panel is offered', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.start-panel:not([hidden]) .start-copy')).toBeVisible();
});

test.describe('375 px, edge fade and code', () => {
  test.use({ viewport: { width: MOBILE_WIDTH, height: 812 } });

  test('the start of the tab row is not faded until the row has scrolled', async ({ page }) => {
    await page.goto('/');
    const atStart = await computedStyleOf({ page, selector: '.start-tabs', pseudo: null, property: 'maskImage' });
    expect(atStart.startsWith('linear-gradient(to right, rgb(0, 0, 0)')).toBe(true);
    await page.locator('.start-tabs').evaluate((element) => element.scrollTo({ left: 120 }));
    await expect
      .poll(() => computedStyleOf({ page, selector: '.start-tabs', pseudo: null, property: 'maskImage' }))
      .toContain('rgba(0, 0, 0, 0)');
  });

  test('a command wraps only at spaces; only the address may break inside a word', async ({ page }) => {
    const command = AGENTS.find((agent) =>
      agent.install.quickStart({ locale: OwnerLocale.EnglishUs, connectionLink: 'x' }).code.includes('--'),
    )!;
    await page.goto(`/?agent=${command.id}`);
    await page.locator('.start-panel:not([hidden]) .start-manual summary').click();
    const codeSelector = '.start-panel:not([hidden]) .start-manual code';
    expect(await computedStyleOf({ page, selector: codeSelector, pseudo: null, property: 'whiteSpace' })).toBe('pre-wrap');
    expect(await computedStyleOf({ page, selector: codeSelector, pseudo: null, property: 'overflowWrap' })).toBe('normal');
    expect(
      await computedStyleOf({
        page,
        selector: '.start-panel:not([hidden]) .start-manual .tok-url',
        pseudo: null,
        property: 'overflowWrap',
      }),
    ).toBe('anywhere');
    const flag = (await page.locator('.start-panel:not([hidden]) .start-manual .tok-flag').first().boundingBox())!;
    const line = (await page.locator('.start-panel:not([hidden]) .start-manual .code-line').first().boundingBox())!;
    expect(flag.height).toBeLessThan(line.height * MAXIMUM_TOKEN_LINES);
    expect(await computedStyleOf({ page, selector: '.start-panel:not([hidden]) .code-block', pseudo: null, property: 'overflowX' })).toBe(
      'auto',
    );
    expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(MOBILE_WIDTH);
  });
});

test('every panel opens with the one line to paste and keeps the manual command collapsed until asked', async ({ page }) => {
  await page.goto('/');
  const panel = visiblePanelsOf({ page });
  await expect(panel.locator('.code-block').first()).toContainText(promptOf({ page }));
  const manual = panel.locator('.start-manual');
  await expect(manual).not.toHaveAttribute('open', '');
  await expect(manual.locator('.code-block')).toBeHidden();
  await manual.locator('summary').click();
  await expect(manual.locator('.code-block')).toBeVisible();
  await expect(manual.locator('summary')).toHaveText(siteCopy({ key: SiteCopyKey.StartManualSummary }));
});

test('the logo of each agent that has a mark is drawn, and the others show their initials', async ({ page }) => {
  await page.goto('/');
  await AGENTS.reduce(async (previous, agent) => {
    await previous;
    const tab = tabOf({ page, id: agent.id });
    if (agent.install.officialLogo === null) {
      await expect(tab.locator('.agent-badge')).toBeVisible();
      return;
    }
    const image = tab.locator('img.start-logo-image');
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          `document.querySelector('#start-tab-${agent.id} img').complete && document.querySelector('#start-tab-${agent.id} img').naturalWidth > 0`,
        ),
      )
      .toBe(true);
  }, Promise.resolve());
});

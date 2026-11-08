import { expect, test, type Locator } from '@playwright/test';
import { DocsLanguage, PAGE_LANGUAGE_FOLDER } from '@zapbip/types';
import { contrastOf } from '../../../tools/repository-shape/src/contrast';
import { DOCS_LOCALE_OF, DocsViewport, NARROW_WIDTH_PX, docsOptionsOf } from './support/docs-experience';

const OVERVIEW_PAGE = 'index';
const GROUP_PAGES = [
  OVERVIEW_PAGE,
  'get-started/how-to-start',
  'agents/claude-code',
  'features/send-messages-and-media',
  'help/faq',
  'developers/errors',
];
const CUSTOM_STYLE_LOCATOR = 'style[data-custom-css-path]';
const HERO_LOCATOR = '.zapbip-hero';
const HERO_COPY_LOCATOR = '.zapbip-hero-copy';
const HERO_VISUAL_LOCATOR = '.zapbip-hero-visual';
const HERO_TEXT_LOCATORS = ['.zapbip-hero-statement', '.zapbip-hero-accent', '.zapbip-hero-lead'];
const LOGO_LOCATOR = 'img[src*="/logo/"]';
const BODY_TEXT_CONTRAST = 4.5;
const COLOR_PROPERTY = 'color';
const HERO_BASE_COLOUR_OF: Record<ColorScheme, string> = { light: '#FFFFFF', dark: '#0D1B17' };

type ColorScheme = 'light' | 'dark';

const COLOR_SCHEMES: ColorScheme[] = ['light', 'dark'];

function urlOf(input: { path: string; language: DocsLanguage }): string {
  if (input.language === DocsLanguage.English) return `/${input.path}`;
  return `/${PAGE_LANGUAGE_FOLDER}/${input.path}`;
}

async function boxOf(input: { locator: Locator }): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await input.locator.boundingBox();
  if (!box) throw new Error('the element has no box');
  return box;
}

async function computedColourOf(input: { locator: Locator }): Promise<string> {
  return input.locator.evaluate((element, property) => getComputedStyle(element).getPropertyValue(property), COLOR_PROPERTY);
}

for (const language of Object.values(DocsLanguage)) {
  test.describe(`ui polish in ${language} at desktop`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    test('the Overview injects the custom stylesheet and shows the hero with its phone clear of the copy', async ({ page }) => {
      await page.goto(urlOf({ path: OVERVIEW_PAGE, language }));
      await expect(page.locator(CUSTOM_STYLE_LOCATOR).first()).toBeAttached();
      await expect(page.locator(HERO_LOCATOR)).toBeVisible();
      const copy = await boxOf({ locator: page.locator(HERO_COPY_LOCATOR) });
      const visual = await boxOf({ locator: page.locator(HERO_VISUAL_LOCATOR) });
      const isBesideCopy = copy.x + copy.width <= visual.x;
      const isBelowCopy = copy.y + copy.height <= visual.y;
      expect(isBesideCopy || isBelowCopy).toBe(true);
    });

    for (const colorScheme of COLOR_SCHEMES) {
      test(`the hero text passes AA in the ${colorScheme} scheme`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(urlOf({ path: OVERVIEW_PAGE, language }));
        await expect(page.locator(HERO_LOCATOR)).toBeVisible();
        for (const selector of HERO_TEXT_LOCATORS) {
          const foreground = await computedColourOf({ locator: page.locator(selector) });
          expect(contrastOf({ foreground, background: HERO_BASE_COLOUR_OF[colorScheme] })).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
        }
      });

      test(`the logo loads in the ${colorScheme} scheme`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(urlOf({ path: OVERVIEW_PAGE, language }));
        const visibleLogo = page.locator(LOGO_LOCATOR).locator('visible=true').first();
        await expect(visibleLogo).toBeVisible();
        const naturalWidth = await visibleLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth);
        expect(naturalWidth).toBeGreaterThan(0);
      });
    }
  });

  test.describe(`ui polish in ${language} at 375`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Narrow }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    test('the hero stacks the copy above the phone', async ({ page }) => {
      await page.goto(urlOf({ path: OVERVIEW_PAGE, language }));
      await expect(page.locator(HERO_LOCATOR)).toBeVisible();
      const copy = await boxOf({ locator: page.locator(HERO_COPY_LOCATOR) });
      const visual = await boxOf({ locator: page.locator(HERO_VISUAL_LOCATOR) });
      expect(copy.y + copy.height).toBeLessThanOrEqual(visual.y);
    });

    for (const path of GROUP_PAGES) {
      test(`${path} does not scroll sideways`, async ({ page }) => {
        await page.goto(urlOf({ path, language }));
        await expect(page.locator('#content-area h1').first()).toBeVisible();
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBe(NARROW_WIDTH_PX);
      });
    }
  });
}

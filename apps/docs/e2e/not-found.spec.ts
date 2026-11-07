import { expect, test } from '@playwright/test';
import { DocsLanguage } from '@zapbip/types';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const PAGE_LANGUAGE_FOLDER = 'pt-br';
const MISSING_PAGE = '/nope';
const NOT_FOUND_STATUS = 404;
const CONTENT_SELECTOR = '#content-area, main';
const NOT_FOUND_CASES: { language: DocsLanguage; path: string; heading: string; overviewLabel: string; overviewHref: string }[] = [
  {
    language: DocsLanguage.English,
    path: MISSING_PAGE,
    heading: 'Page not found',
    overviewLabel: 'Back to the Overview',
    overviewHref: '/',
  },
  {
    language: DocsLanguage.PortugueseBrazil,
    path: `/${PAGE_LANGUAGE_FOLDER}${MISSING_PAGE}`,
    heading: 'Página não encontrada',
    overviewLabel: 'Voltar para a visão geral',
    overviewHref: `/${PAGE_LANGUAGE_FOLDER}`,
  },
];

for (const { language, path, heading, overviewLabel, overviewHref } of NOT_FOUND_CASES) {
  test.describe(`a missing page in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    test('says so in the reader language and links the Overview', async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(NOT_FOUND_STATUS);
      await expect(page.locator(CONTENT_SELECTOR).first()).toContainText(heading);
      await expect(page.locator(CONTENT_SELECTOR).first().getByRole('link', { name: overviewLabel })).toHaveAttribute('href', overviewHref);
    });
  });
}

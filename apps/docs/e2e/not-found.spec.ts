import { expect, test } from '@playwright/test';
import { DocsPageLanguage } from '@zapbip/types';
import { twinPathOf } from '../../../libs/agents/src/docs';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const MISSING_PAGE = '/nope';
const NOT_FOUND_STATUS = 404;
const CONTENT_SELECTOR = '#content-area, main';
const NOT_FOUND_LABELS: Record<DocsPageLanguage, { heading: string; overviewLabel: string }> = {
  [DocsPageLanguage.English]: { heading: 'Page not found', overviewLabel: 'Back to the Overview' },
  [DocsPageLanguage.PortugueseBrazil]: { heading: 'Página não encontrada', overviewLabel: 'Voltar para a visão geral' },
  [DocsPageLanguage.Spanish]: { heading: 'Página no encontrada', overviewLabel: 'Volver a la visión general' },
  [DocsPageLanguage.German]: { heading: 'Seite nicht gefunden', overviewLabel: 'Zurück zur Übersicht' },
  [DocsPageLanguage.French]: { heading: 'Page introuvable', overviewLabel: 'Retour à l’aperçu' },
  [DocsPageLanguage.Japanese]: { heading: 'ページが見つかりません', overviewLabel: '概要に戻る' },
  [DocsPageLanguage.Korean]: { heading: '페이지를 찾을 수 없음', overviewLabel: '개요로 돌아가기' },
  [DocsPageLanguage.Chinese]: { heading: '页面未找到', overviewLabel: '返回概览' },
  [DocsPageLanguage.Arabic]: { heading: 'الصفحة غير موجودة', overviewLabel: 'العودة إلى النظرة العامة' },
};
const NOT_FOUND_CASES = Object.values(DocsPageLanguage).map((language) => ({
  language,
  path: `/${twinPathOf({ path: MISSING_PAGE.slice(1), language })}`,
  ...NOT_FOUND_LABELS[language],
  overviewHref: `/${twinPathOf({ path: '', language }).replace(/\/$/, '')}`,
}));

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

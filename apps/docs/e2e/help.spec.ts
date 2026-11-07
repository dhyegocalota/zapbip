import { expect, test } from '@playwright/test';
import { DocsLanguage, DocsRetentionKind } from '@zapbip/types';
import { RETENTION_DAYS } from '../../../tools/repository-shape/src/docs-experience';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const PAGE_LANGUAGE_FOLDER = 'pt-br';
const OK_STATUS = 200;
const FOOTER_LABEL = 'zapbip · Logic Bit';
const HELP_PAGES = ['troubleshooting', 'faq', 'privacy-and-security', 'revoke-and-rotate-keys', 'delete-your-account', 'about'];
const DAYS_WORD: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'days',
  [DocsLanguage.PortugueseBrazil]: 'dias',
};
const WAITLIST_QUESTION: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'What if my account is on the waitlist?',
  [DocsLanguage.PortugueseBrazil]: 'E se a minha conta estiver na lista de espera?',
};
const WAITLIST_ANSWER_TOKENS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['zapbip team', 'help'],
  [DocsLanguage.PortugueseBrazil]: ['equipe do zapbip', 'ajuda'],
};
const REVOKE_TOKENS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['revoke', 'rotate', 'once'],
  [DocsLanguage.PortugueseBrazil]: ['revogar', 'girar', 'uma vez'],
};
const DELETE_TOKENS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['delete account', 'delete account permanently', 'Meta', 'Cloudflare', 'waitlist'],
  [DocsLanguage.PortugueseBrazil]: ['apagar conta', 'apagar conta definitivamente', 'Meta', 'Cloudflare', 'lista de espera'],
};
const PRIVACY_KINDS = Object.values(DocsRetentionKind);
const PRIVACY_TOKENS = ['Meta', 'Cloudflare'];

function urlOf(input: { path: string; language: DocsLanguage }): string {
  if (input.language === DocsLanguage.English) return `/help/${input.path}`;
  return `/${PAGE_LANGUAGE_FOLDER}/help/${input.path}`;
}

for (const language of Object.values(DocsLanguage)) {
  test.describe(`help in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    for (const path of HELP_PAGES) {
      test(`${path} renders with a title and the Logic Bit footer`, async ({ page }) => {
        const response = await page.goto(urlOf({ path, language }));
        expect(response?.status()).toBe(OK_STATUS);
        await expect(page.locator('h1').first()).not.toBeEmpty();
        await expect(page.getByRole('link', { name: FOOTER_LABEL }).first()).toBeVisible();
      });
    }

    test('privacy and security states every retention figure and who else keeps data', async ({ page }) => {
      await page.goto(urlOf({ path: 'privacy-and-security', language }));
      const content = page.locator('#content-area');
      for (const kind of PRIVACY_KINDS) {
        await expect(content).toContainText(new RegExp(`${RETENTION_DAYS[kind]}\\s+${DAYS_WORD[language]}`));
      }
      for (const token of PRIVACY_TOKENS) await expect(content).toContainText(token);
    });

    test('revoke and rotate names both words and says a rotated link is sent once', async ({ page }) => {
      await page.goto(urlOf({ path: 'revoke-and-rotate-keys', language }));
      for (const token of REVOKE_TOKENS[language]) await expect(page.locator('#content-area')).toContainText(token);
    });

    test('delete your account gives both phrases, what Meta and Cloudflare keep and the new waitlist account', async ({ page }) => {
      await page.goto(urlOf({ path: 'delete-your-account', language }));
      for (const token of DELETE_TOKENS[language]) await expect(page.locator('#content-area')).toContainText(token);
    });

    test('the FAQ answers the waitlist question', async ({ page }) => {
      await page.goto(urlOf({ path: 'faq', language }));
      const question = page.getByText(WAITLIST_QUESTION[language], { exact: true });
      await expect(question).toBeVisible();
      await question.click();
      for (const token of WAITLIST_ANSWER_TOKENS[language]) await expect(page.locator('#content-area')).toContainText(token);
    });

    test('every FAQ question has an answer', async ({ page }) => {
      await page.goto(urlOf({ path: 'faq', language }));
      const answers = await page.locator('#content-area [data-component-part="accordion-content"]').allTextContents();
      expect(answers.length).toBeGreaterThan(0);
      expect(answers.filter((answer) => answer.trim() === '')).toEqual([]);
    });
  });
}

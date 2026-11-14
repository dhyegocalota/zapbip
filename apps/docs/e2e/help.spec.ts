import { expect, test } from '@playwright/test';
import { DocsPageLanguage, DocsRetentionKind } from '@zapbip/types';
import { RETENTION_DAYS } from '../../../tools/repository-shape/src/docs-experience';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';
import { twinPathOf } from '../../../libs/agents/src/docs';

const OK_STATUS = 200;
const FOOTER_LABEL = 'zapbip · Logic Bit';
const HELP_PAGES = ['troubleshooting', 'faq', 'privacy-and-security', 'revoke-and-rotate-keys', 'delete-your-account', 'about'];
const DAYS_WORD: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'days',
  [DocsPageLanguage.PortugueseBrazil]: 'dias',
  [DocsPageLanguage.Spanish]: 'días',
  [DocsPageLanguage.German]: 'Tage',
  [DocsPageLanguage.French]: 'jours',
  [DocsPageLanguage.Japanese]: '日',
  [DocsPageLanguage.Korean]: '일',
  [DocsPageLanguage.Chinese]: '天',
  [DocsPageLanguage.Arabic]: 'أيام|يومًا',
};
const WAITLIST_QUESTION: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'What if my account is on the waitlist?',
  [DocsPageLanguage.PortugueseBrazil]: 'E se a minha conta estiver na lista de espera?',
  [DocsPageLanguage.Spanish]: '¿Y si mi cuenta está en la lista de espera?',
  [DocsPageLanguage.German]: 'Was ist, wenn mein Konto auf der Warteliste steht?',
  [DocsPageLanguage.French]: "Et si mon compte est sur la liste d'attente ?",
  [DocsPageLanguage.Japanese]: 'アカウントがウェイトリストにある場合は？',
  [DocsPageLanguage.Korean]: '계정이 대기자 명단에 있으면 어떻게 되나요?',
  [DocsPageLanguage.Chinese]: '如果我的账号在候补名单上会怎样？',
  [DocsPageLanguage.Arabic]: 'ماذا لو كان حسابي في قائمة الانتظار؟',
};
const WAITLIST_ANSWER_TOKENS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['zapbip team', 'help'],
  [DocsPageLanguage.PortugueseBrazil]: ['equipe do zapbip', 'ajuda'],
  [DocsPageLanguage.Spanish]: ['equipo de zapbip', 'help'],
  [DocsPageLanguage.German]: ['zapbip-Team', 'help'],
  [DocsPageLanguage.French]: ['équipe zapbip', 'help'],
  [DocsPageLanguage.Japanese]: ['zapbip チーム', 'help'],
  [DocsPageLanguage.Korean]: ['zapbip 팀', 'help'],
  [DocsPageLanguage.Chinese]: ['zapbip 团队', 'help'],
  [DocsPageLanguage.Arabic]: ['فريق zapbip', 'مساعدة'],
};
const REVOKE_TOKENS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['revoke', 'rotate', 'once'],
  [DocsPageLanguage.PortugueseBrazil]: ['revogar', 'renovar', 'uma vez'],
  [DocsPageLanguage.Spanish]: ['revocar', 'rotar', 'una vez'],
  [DocsPageLanguage.German]: ['widerrufen', 'erneuern', 'einmal'],
  [DocsPageLanguage.French]: ['révoquer', 'renouveler', 'une fois'],
  [DocsPageLanguage.Japanese]: ['無効化', '再発行', '1 回'],
  [DocsPageLanguage.Korean]: ['폐기', '재발급', '한 번'],
  [DocsPageLanguage.Chinese]: ['撤销', '轮换', '一次'],
  [DocsPageLanguage.Arabic]: ['إبطال', 'تجديد رابط', 'مرة واحدة'],
};
const DELETE_TOKENS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['delete account', 'delete account permanently', 'Meta', 'Cloudflare', 'waitlist'],
  [DocsPageLanguage.PortugueseBrazil]: ['apagar conta', 'apagar conta definitivamente', 'Meta', 'Cloudflare', 'lista de espera'],
  [DocsPageLanguage.Spanish]: ['eliminar cuenta', 'eliminar cuenta definitivamente', 'Meta', 'Cloudflare', 'lista de espera'],
  [DocsPageLanguage.German]: ['konto löschen', 'konto endgültig löschen', 'Meta', 'Cloudflare', 'Warteliste'],
  [DocsPageLanguage.French]: ['supprimer le compte', 'supprimer le compte définitivement', 'Meta', 'Cloudflare', 'liste d’attente'],
  [DocsPageLanguage.Japanese]: ['アカウント削除', 'アカウント完全削除', 'Meta', 'Cloudflare', 'ウェイトリスト'],
  [DocsPageLanguage.Korean]: ['계정 삭제', '계정 영구 삭제', 'Meta', 'Cloudflare', '대기자 명단'],
  [DocsPageLanguage.Chinese]: ['删除账户', '永久删除账户', 'Meta', 'Cloudflare', '候补名单'],
  [DocsPageLanguage.Arabic]: ['حذف الحساب', 'حذف الحساب نهائيا', 'Meta', 'Cloudflare', 'قائمة الانتظار'],
};
const PRIVACY_KINDS = Object.values(DocsRetentionKind);
const PRIVACY_TOKENS = ['Meta', 'Cloudflare'];

function urlOf(input: { path: string; language: DocsPageLanguage }): string {
  return `/${twinPathOf({ path: `help/${input.path}`, language: input.language })}`;
}

for (const language of Object.values(DocsPageLanguage)) {
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
        await expect(content).toContainText(new RegExp(`${RETENTION_DAYS[kind]}\\s*(?:${DAYS_WORD[language]})`));
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
      await expect(page.locator('#content-area [data-component-part="accordion-content"]').first()).toBeAttached();
      const answers = await page.locator('#content-area [data-component-part="accordion-content"]').allTextContents();
      expect(answers.length).toBeGreaterThan(0);
      expect(answers.filter((answer) => answer.trim() === '')).toEqual([]);
    });
  });
}

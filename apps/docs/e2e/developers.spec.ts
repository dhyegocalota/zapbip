import { expect, test } from '@playwright/test';
import { DOCS_LANGUAGE_FOLDERS, DocsPageLanguage } from '@zapbip/types';
import { WAKE_RUNG_LABELS } from '../../../tools/repository-shape/src/docs-experience';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';
import { twinPathOf } from '../../../libs/agents/src/docs';

const OK_STATUS = 200;
const CONCEPT_LINK_PATTERN = new RegExp(
  `^(/(${Object.values(DOCS_LANGUAGE_FOLDERS)
    .filter((folder) => folder !== '')
    .join('|')}))?/(concepts|developers|mcp-reference)/`,
);
const FOOTER_LABEL = 'zapbip · Logic Bit';
const DEVELOPER_PAGES = [
  'developers/any-mcp-client',
  'developers/errors',
  'developers/local-connector',
  'developers/background-running',
  'developers/webhook-wake',
];
const CONCEPT_PAGES = [
  'concepts/inbox',
  'concepts/questions',
  'concepts/24-hour-window',
  'concepts/routing',
  'concepts/wake-ladder',
  'concepts/whatsapp-channel',
  'concepts/owner-notices',
];
const CONNECTOR_FLAGS = ['--client', '--cwd', '--session', 'ZAPBIP_CONNECTION_URL'];
const BACKGROUND_TOKENS = ['launchd', 'systemd', '600'];
const WEBHOOK_BACKOFF_SECONDS = ['5', '10', '20', '40'];
const MEASURED_WAKE_SECONDS = ['7', '6', '9', '16'];
const TEMPLATE_NAMES = ['zapbip_agent_notice', 'zapbip_agent_question'];
const NOTICE_RETRY_TOKENS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['5 minutes', '6 hours'],
  [DocsPageLanguage.PortugueseBrazil]: ['5 minutos', '6 horas'],
  [DocsPageLanguage.Spanish]: ['5 minutos', '6 horas'],
  [DocsPageLanguage.German]: ['5 Minuten', '6 Stunden'],
  [DocsPageLanguage.French]: ['5 minutes', '6 heures'],
  [DocsPageLanguage.Japanese]: ['5 分', '6 時間'],
  [DocsPageLanguage.Korean]: ['5분', '6시간'],
  [DocsPageLanguage.Chinese]: ['5 分钟', '6 小时'],
  [DocsPageLanguage.Arabic]: ['5 دقائق', '6 ساعات'],
  [DocsPageLanguage.Hindi]: ['5 मिनट', '6 घंटे'],
};
const QUICK_REPLIES: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['Open', 'Reply'],
  [DocsPageLanguage.PortugueseBrazil]: ['Abrir', 'Responder'],
  [DocsPageLanguage.Spanish]: ['Open', 'Reply'],
  [DocsPageLanguage.German]: ['Open', 'Reply'],
  [DocsPageLanguage.French]: ['Open', 'Reply'],
  [DocsPageLanguage.Japanese]: ['Open', 'Reply'],
  [DocsPageLanguage.Korean]: ['Open', 'Reply'],
  [DocsPageLanguage.Chinese]: ['Open', 'Reply'],
  [DocsPageLanguage.Arabic]: ['Open', 'Reply'],
  [DocsPageLanguage.Hindi]: ['Open', 'Reply'],
};
const CHANNEL_HEADINGS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['Inbound', 'Outbound', 'Delivery'],
  [DocsPageLanguage.PortugueseBrazil]: ['Mensagens que chegam', 'Mensagens que saem', 'Entrega'],
  [DocsPageLanguage.Spanish]: ['Mensajes entrantes', 'Mensajes salientes', 'Entrega'],
  [DocsPageLanguage.German]: ['Eingehende Nachrichten', 'Ausgehende Nachrichten', 'Zustellung'],
  [DocsPageLanguage.French]: ['Messages entrants', 'Messages sortants', 'Remise'],
  [DocsPageLanguage.Japanese]: ['受信メッセージ', '送信メッセージ', '配信'],
  [DocsPageLanguage.Korean]: ['수신 메시지', '발신 메시지', '전달'],
  [DocsPageLanguage.Chinese]: ['入站消息', '出站消息', '投递'],
  [DocsPageLanguage.Arabic]: ['الرسائل الواردة', 'الرسائل الصادرة', 'حالة التسليم'],
  [DocsPageLanguage.Hindi]: ['आने वाले संदेश', 'जाने वाले संदेश', 'डिलीवरी'],
};

function urlOf(input: { path: string; language: DocsPageLanguage }): string {
  return `/${twinPathOf({ path: input.path, language: input.language })}`;
}

for (const language of Object.values(DocsPageLanguage)) {
  test.describe(`developers and concepts in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    for (const path of [...DEVELOPER_PAGES, ...CONCEPT_PAGES]) {
      test(`${path} opens with a title, a body and the Logic Bit footer`, async ({ page }) => {
        const response = await page.goto(urlOf({ path, language }));
        expect(response?.status()).toBe(OK_STATUS);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('#content-area')).toContainText(/\S{3,}\s+\S{3,}/);
        await expect(page.getByRole('link', { name: FOOTER_LABEL }).first()).toBeVisible();
      });
    }

    test('the local connector page names every flag and the environment variable', async ({ page }) => {
      await page.goto(urlOf({ path: 'developers/local-connector', language }));
      for (const token of CONNECTOR_FLAGS) await expect(page.locator('#content-area')).toContainText(token);
    });

    test('the background running page covers launchd, systemd and file mode 600', async ({ page }) => {
      await page.goto(urlOf({ path: 'developers/background-running', language }));
      for (const token of BACKGROUND_TOKENS) await expect(page.locator('#content-area')).toContainText(token);
    });

    test('the webhook wake page states the backoff of 5, 10, 20 and 40 seconds', async ({ page }) => {
      await page.goto(urlOf({ path: 'developers/webhook-wake', language }));
      for (const seconds of WEBHOOK_BACKOFF_SECONDS) await expect(page.locator('#content-area')).toContainText(seconds);
    });

    test('the wake ladder lists every rung by its label and the measured delays', async ({ page }) => {
      await page.goto(urlOf({ path: 'concepts/wake-ladder', language }));
      for (const label of Object.values(WAKE_RUNG_LABELS[language])) {
        await expect(page.locator('#content-area table').getByText(label, { exact: false }).first()).toBeVisible();
      }
      for (const seconds of MEASURED_WAKE_SECONDS) await expect(page.locator('#content-area table').first()).toContainText(seconds);
    });

    test('the owner notices page names both templates, the quick replies and the retry backoff', async ({ page }) => {
      await page.goto(urlOf({ path: 'concepts/owner-notices', language }));
      const content = page.locator('#content-area');
      for (const token of [...TEMPLATE_NAMES, ...QUICK_REPLIES[language], ...NOTICE_RETRY_TOKENS[language]]) {
        await expect(content).toContainText(token);
      }
    });

    test('the WhatsApp channel page has its three sections and a limits table', async ({ page }) => {
      await page.goto(urlOf({ path: 'concepts/whatsapp-channel', language }));
      for (const heading of CHANNEL_HEADINGS[language]) await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.locator('#content-area table').first()).toBeVisible();
    });

    for (const path of CONCEPT_PAGES) {
      test(`${path} links only to concepts, developers and the tool reference`, async ({ page }) => {
        await page.goto(urlOf({ path, language }));
        const hrefs = await page
          .locator('#content-area a[href^="/"]')
          .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
        const strayHrefs = hrefs.filter((href) => href !== null && !CONCEPT_LINK_PATTERN.test(href));
        expect(strayHrefs).toEqual([]);
      });
    }
  });
}

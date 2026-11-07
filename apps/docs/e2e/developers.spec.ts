import { expect, test } from '@playwright/test';
import { DocsLanguage } from '@zapbip/types';
import { WAKE_RUNG_LABELS } from '../../../tools/repository-shape/src/docs-experience';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const PAGE_LANGUAGE_FOLDER = 'pt-br';
const OK_STATUS = 200;
const CONCEPT_LINK_PATTERN = /^(\/pt-br)?\/(concepts|developers|mcp-reference)\//;
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
const NOTICE_RETRY_TOKENS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['5 minutes', '6 hours'],
  [DocsLanguage.PortugueseBrazil]: ['5 minutos', '6 horas'],
};
const QUICK_REPLIES: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['Open', 'Reply'],
  [DocsLanguage.PortugueseBrazil]: ['Abrir', 'Responder'],
};
const CHANNEL_HEADINGS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['Inbound', 'Outbound', 'Delivery'],
  [DocsLanguage.PortugueseBrazil]: ['Mensagens que chegam', 'Mensagens que saem', 'Entrega'],
};

function urlOf(input: { path: string; language: DocsLanguage }): string {
  if (input.language === DocsLanguage.English) return `/${input.path}`;
  return `/${PAGE_LANGUAGE_FOLDER}/${input.path}`;
}

for (const language of Object.values(DocsLanguage)) {
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

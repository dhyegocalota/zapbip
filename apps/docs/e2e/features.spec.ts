import { expect, test } from '@playwright/test';
import { DocsLanguage, MessageKind } from '@zapbip/types';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';

const PAGE_LANGUAGE_FOLDER = 'pt-br';
const OK_STATUS = 200;
const CHAT_SELECTOR = '#content-area [role="group"][aria-label^="WhatsApp"]';
const FEATURE_PAGES = [
  'features/send-messages-and-media',
  'features/ask-with-buttons-and-lists',
  'features/owner-starts-conversations',
  'features/many-agents-on-one-number',
  'features/whatsapp-commands',
  'features/the-24-hour-window',
];
const LISTEN_DELAY_SECONDS = ['7', '6', '9', '16'];
const WAKE_RUNG_WORDS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['connector', 'webhook', 'scheduled', 'inbox'],
  [DocsLanguage.PortugueseBrazil]: ['conector', 'webhook', 'agendad', 'caixa de entrada'],
};
const NOT_LISTENING_TOKEN: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'is not listening right now',
  [DocsLanguage.PortugueseBrazil]: 'não está ouvindo agora',
};
const COMMAND_WORDS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['new agent', 'agents', 'revoke', 'rotate', 'help', 'delete account', 'delete account permanently'],
  [DocsLanguage.PortugueseBrazil]: ['novo agente', 'agentes', 'revogar', 'girar', 'ajuda', 'apagar conta', 'apagar conta definitivamente'],
};
const OTHER_LANGUAGE_COMMAND_WORDS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: COMMAND_WORDS[DocsLanguage.PortugueseBrazil],
  [DocsLanguage.PortugueseBrazil]: COMMAND_WORDS[DocsLanguage.English],
};
const RESERVED_NAME_TOKEN: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'reserved',
  [DocsLanguage.PortugueseBrazil]: 'reservad',
};
const FORWARDED_TOKEN: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'forwarded',
  [DocsLanguage.PortugueseBrazil]: 'encaminhad',
};

function urlOf(input: { path: string; language: DocsLanguage }): string {
  if (input.language === DocsLanguage.English) return `/${input.path}`;
  return `/${PAGE_LANGUAGE_FOLDER}/${input.path}`;
}

for (const language of Object.values(DocsLanguage)) {
  test.describe(`feature pages in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    for (const path of FEATURE_PAGES) {
      test(`${path} opens and shows at least one conversation`, async ({ page }) => {
        const response = await page.goto(urlOf({ path, language }));
        expect(response?.status()).toBe(OK_STATUS);
        await expect(page.locator(CHAT_SELECTOR).first()).toBeVisible();
      });
    }

    test('send-messages-and-media names every message kind', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/send-messages-and-media', language }));
      for (const kind of Object.values(MessageKind)) await expect(page.locator('#content-area')).toContainText(kind);
    });

    test('owner-starts-conversations explains the wake ladder with the expected delays', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/owner-starts-conversations', language }));
      const content = page.locator('#content-area');
      for (const word of WAKE_RUNG_WORDS[language]) await expect(content).toContainText(word, { ignoreCase: true });
      for (const seconds of LISTEN_DELAY_SECONDS) await expect(content).toContainText(seconds);
    });

    test('owner-starts-conversations shows the not-listening notice', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/owner-starts-conversations', language }));
      await expect(page.locator(CHAT_SELECTOR).filter({ hasText: NOT_LISTENING_TOKEN[language] }).first()).toBeVisible();
    });

    test('whatsapp-commands lists every command word with the other language beside it', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/whatsapp-commands', language }));
      const table = page.locator('#content-area table').first();
      for (const word of [...COMMAND_WORDS[language], ...OTHER_LANGUAGE_COMMAND_WORDS[language]]) await expect(table).toContainText(word);
    });

    test('whatsapp-commands states the reserved names rule and that forwarded messages never run a command', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/whatsapp-commands', language }));
      const content = page.locator('#content-area');
      await expect(content).toContainText(RESERVED_NAME_TOKEN[language], { ignoreCase: true });
      await expect(content).toContainText(FORWARDED_TOKEN[language], { ignoreCase: true });
    });
  });
}

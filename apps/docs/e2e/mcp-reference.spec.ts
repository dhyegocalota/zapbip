import { expect, test } from '@playwright/test';
import { DocsLanguage, MessageKind } from '@zapbip/types';

const MESSAGE_SENDING_PAGES = ['send-message', 'send-media', 'send-location', 'send-contact', 'react', 'ask'];
const LANGUAGE_PREFIX_OF: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: '',
  [DocsLanguage.PortugueseBrazil]: '/pt-br',
};

for (const language of Object.values(DocsLanguage)) {
  for (const page of MESSAGE_SENDING_PAGES) {
    test(`${language} ${page} has a message kinds table listing every kind`, async ({ page: browserPage }) => {
      await browserPage.goto(`${LANGUAGE_PREFIX_OF[language]}/mcp-reference/${page}`);
      const table = browserPage.getByRole('table').last();
      await expect(table).toBeVisible();
      for (const kind of Object.values(MessageKind))
        await expect(table.getByRole('cell', { name: kind, exact: true }).first()).toBeVisible();
    });
  }
}

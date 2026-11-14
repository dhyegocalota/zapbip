import { expect, test } from '@playwright/test';
import { DocsPageLanguage, MessageKind } from '@zapbip/types';
import { twinPathOf } from '../../../libs/agents/src/docs';

const MESSAGE_SENDING_PAGES = ['send-message', 'send-media', 'send-location', 'send-contact', 'react', 'ask'];

for (const language of Object.values(DocsPageLanguage)) {
  for (const page of MESSAGE_SENDING_PAGES) {
    test(`${language} ${page} has a message kinds table listing every kind`, async ({ page: browserPage }) => {
      await browserPage.goto(`/${twinPathOf({ path: `mcp-reference/${page}`, language })}`);
      const table = browserPage.getByRole('table').last();
      await expect(table).toBeVisible();
      for (const kind of Object.values(MessageKind))
        await expect(table.getByRole('cell', { name: kind, exact: true }).first()).toBeVisible();
    });
  }
}

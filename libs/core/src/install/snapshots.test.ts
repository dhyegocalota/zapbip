import { InstallClient, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { INSTALL_SECTIONS } from './prompts/index';
import { CLIENTS, LOCALES, sectionInput } from './testing/fixtures';

const SNAPSHOT_DIRECTORY = './snapshots';
const STANDBY_AGENT = 'Ana Bot';

describe('install section snapshots', () => {
  test.each(CLIENTS.flatMap((client) => LOCALES.map((locale) => ({ client, locale }))))(
    '$client in $locale',
    async ({ client, locale }) => {
      await expect(INSTALL_SECTIONS[client](sectionInput({ locale }))).toMatchFileSnapshot(`${SNAPSHOT_DIRECTORY}/${client}.${locale}.md`);
    },
  );

  test.each(LOCALES)('grok-web with a standby agent in %s', async (locale: OwnerLocale) => {
    const text = INSTALL_SECTIONS[InstallClient.GrokWeb](sectionInput({ locale, standbyAgent: STANDBY_AGENT }));
    await expect(text).toMatchFileSnapshot(`${SNAPSHOT_DIRECTORY}/${InstallClient.GrokWeb}.standby.${locale}.md`);
  });
});

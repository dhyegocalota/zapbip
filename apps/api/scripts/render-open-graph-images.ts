import { join } from 'node:path';
import { OwnerLocale } from '@zapbip/types';
import { languageOf } from '../src/web-shell/locale-profiles';
import { openGraphDataOf } from './landing-demo/demo-copy';
import { renderOpenGraphImage } from './landing-demo/open-graph-image';

const OUTPUT_DIRECTORY = join(import.meta.dirname, '..', 'site-public', 'site');

async function main(): Promise<void> {
  await Object.values(OwnerLocale).reduce(async (previous, locale) => {
    await previous;
    await renderOpenGraphImage({
      data: openGraphDataOf({ locale }),
      language: languageOf({ locale }),
      target: join(OUTPUT_DIRECTORY, `og-${locale}.png`),
    });
  }, Promise.resolve());
}

await main();

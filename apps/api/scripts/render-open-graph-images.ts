import { join } from 'node:path';
import { WebLocale } from '@zapbip/types';
import { languageOf } from '../src/web-shell/locale-profiles';
import { renderSiteCopy, SiteCopyKey } from '../src/site/site-copy';
import { SENDER_INDEXES, senderNameOf } from '../src/site/site-agents';
import { OPEN_GRAPH_PHONE_COPY } from './landing-demo/open-graph-copy';
import { renderOpenGraphImage } from './landing-demo/open-graph-image';

const OUTPUT_DIRECTORY = join(import.meta.dirname, '..', 'site-public', 'site');
const TAGLINE_PREFIX = 'zapbip.com · ';

async function renderLocale(input: { locale: WebLocale; question: string; options: string[] }): Promise<void> {
  const { locale, question, options } = input;
  const copy = (key: SiteCopyKey): string => renderSiteCopy({ key, locale });
  await renderOpenGraphImage({
    language: languageOf({ locale }),
    target: join(OUTPUT_DIRECTORY, `og-${locale}.png`),
    data: {
      titleLead: copy(SiteCopyKey.HeroTitleLead),
      titleAccent: copy(SiteCopyKey.HeroTitleAccent),
      tagline: `${TAGLINE_PREFIX}${copy(SiteCopyKey.FinalButton)}`,
      agentName: senderNameOf({ index: SENDER_INDEXES.first }),
      questionShort: question,
      options,
    },
  });
}

async function main(): Promise<void> {
  await Object.entries(OPEN_GRAPH_PHONE_COPY).reduce(async (previous, [locale, phone]) => {
    await previous;
    await renderLocale({ locale: locale as WebLocale, question: phone.question, options: phone.options });
  }, Promise.resolve());
}

await main();

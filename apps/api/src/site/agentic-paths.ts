import type { WebLocale } from '@zapbip/types';
import { legalPathOf } from './legal-links';
import type { PageModel } from './page-model';
import { localePathOf } from './site-language';
import { SitePath } from './site-paths';

const MARKDOWN_EXTENSION = '.md';
const HOME_MARKDOWN_PATH = '/index.md';

export enum LlmsFile {
  Summary = 'summary',
  Full = 'full',
}

const LLMS_PATHS: Record<LlmsFile, SitePath> = {
  [LlmsFile.Summary]: SitePath.LlmsText,
  [LlmsFile.Full]: SitePath.LlmsFullText,
};

export function markdownPathOf(input: { htmlPath: string }): string {
  return input.htmlPath === SitePath.Home ? HOME_MARKDOWN_PATH : `${input.htmlPath}${MARKDOWN_EXTENSION}`;
}

function localizedFilePathOf(input: { locale: WebLocale; path: SitePath }): string {
  const homePath = localePathOf({ locale: input.locale });
  const prefix = homePath === SitePath.Home ? '' : homePath;
  return `${prefix}${input.path}`;
}

export function llmsPathOf(input: { locale: WebLocale; file: LlmsFile }): string {
  return localizedFilePathOf({ locale: input.locale, path: LLMS_PATHS[input.file] });
}

export function setupPathOf(input: { locale: WebLocale }): string {
  return localizedFilePathOf({ locale: input.locale, path: SitePath.Setup });
}

export function setupUrlOf(input: { locale: WebLocale; origin: string }): string {
  return `${input.origin}${setupPathOf({ locale: input.locale })}`;
}

export function markdownUrlOf(input: { model: PageModel }): string {
  const { model } = input;
  const htmlPath =
    model.legalDocument === null
      ? localePathOf({ locale: model.locale })
      : legalPathOf({ document: model.legalDocument, locale: model.locale });
  return `${model.siteOrigin}${markdownPathOf({ htmlPath })}`;
}

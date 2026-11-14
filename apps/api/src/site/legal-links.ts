import { WEB_LOCALE_PATH_PREFIXES, WebLocale } from '@zapbip/types';
import { SitePath } from './site-paths';

export enum LegalDocument {
  Terms = 'terms',
  Privacy = 'privacy',
}

export type LegalPage = { document: LegalDocument; locale: WebLocale };

const PORTUGUESE_LEGAL_PATHS: Record<LegalDocument, SitePath> = {
  [LegalDocument.Terms]: SitePath.PortugueseTerms,
  [LegalDocument.Privacy]: SitePath.PortuguesePrivacy,
};
const ENGLISH_LEGAL_PATHS: Record<LegalDocument, SitePath> = {
  [LegalDocument.Terms]: SitePath.Terms,
  [LegalDocument.Privacy]: SitePath.Privacy,
};

export const LEGAL_PAGES: LegalPage[] = Object.values(LegalDocument).flatMap((document) =>
  Object.values(WebLocale).map((locale) => ({ document, locale })),
);

export function legalPathOf(input: LegalPage): string {
  if (input.locale === WebLocale.PortugueseBrazil) return PORTUGUESE_LEGAL_PATHS[input.document];
  return `${WEB_LOCALE_PATH_PREFIXES[input.locale]}${ENGLISH_LEGAL_PATHS[input.document]}`;
}

export function legalPageOf(input: { pathname: string }): LegalPage | null {
  const page = LEGAL_PAGES.find((candidate) => legalPathOf(candidate) === input.pathname);
  return page === undefined ? null : page;
}

export function legalUrlOf(input: { origin: string; document: LegalDocument; locale: WebLocale }): string {
  return `${input.origin}${legalPathOf({ document: input.document, locale: input.locale })}`;
}

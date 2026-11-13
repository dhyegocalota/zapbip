import { OwnerLocale } from '@zapbip/types';
import { SitePath } from './site-paths';

export enum LegalDocument {
  Terms = 'terms',
  Privacy = 'privacy',
}

export type LegalPage = { document: LegalDocument; locale: OwnerLocale };

const LEGAL_PATHS: Record<LegalDocument, Record<OwnerLocale, SitePath>> = {
  [LegalDocument.Terms]: { [OwnerLocale.EnglishUs]: SitePath.Terms, [OwnerLocale.PortugueseBrazil]: SitePath.PortugueseTerms },
  [LegalDocument.Privacy]: { [OwnerLocale.EnglishUs]: SitePath.Privacy, [OwnerLocale.PortugueseBrazil]: SitePath.PortuguesePrivacy },
};

export const LEGAL_PAGES: LegalPage[] = Object.values(LegalDocument).flatMap((document) =>
  Object.values(OwnerLocale).map((locale) => ({ document, locale })),
);

export function legalPathOf(input: LegalPage): string {
  return LEGAL_PATHS[input.document][input.locale];
}

export function legalPageOf(input: { pathname: string }): LegalPage | null {
  const page = LEGAL_PAGES.find((candidate) => legalPathOf(candidate) === input.pathname);
  return page === undefined ? null : page;
}

export function legalUrlOf(input: { origin: string; document: LegalDocument; locale: OwnerLocale }): string {
  return `${input.origin}${legalPathOf({ document: input.document, locale: input.locale })}`;
}

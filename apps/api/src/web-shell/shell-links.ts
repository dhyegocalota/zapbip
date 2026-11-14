import { COMPANY, type WebLocale, PRODUCTION_ZONE } from '@zapbip/types';
import { LegalDocument, legalUrlOf } from '../site/legal-links';
import { DOCS_ORIGIN } from '../site/site-paths';
import { LOCALE_PROFILES } from './locale-profiles';
import { ShellCopyKey } from './shell-copy';

const SHELL_SITE_ORIGIN = `https://${PRODUCTION_ZONE}`;
const NOOPENER_RELATIONSHIP = 'noopener';

export type ShellFooterLink = { href: string; label: ShellCopyKey; rel?: string };

export function docsUrlOf(input: { locale: WebLocale; path: string }): string {
  return `${DOCS_ORIGIN}${LOCALE_PROFILES[input.locale].docsPath}${input.path}`;
}

export function shellFooterLinksOf(input: { locale: WebLocale }): ShellFooterLink[] {
  const { locale } = input;
  return [
    { href: docsUrlOf({ locale, path: '' }), label: ShellCopyKey.FooterDocs },
    { href: legalUrlOf({ origin: SHELL_SITE_ORIGIN, document: LegalDocument.Terms, locale }), label: ShellCopyKey.FooterTerms },
    { href: legalUrlOf({ origin: SHELL_SITE_ORIGIN, document: LegalDocument.Privacy, locale }), label: ShellCopyKey.FooterPrivacy },
    { href: COMPANY.website, label: ShellCopyKey.FooterMadeBy, rel: NOOPENER_RELATIONSHIP },
  ];
}

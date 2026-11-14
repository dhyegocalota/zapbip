import { OwnerLocale } from '@zapbip/types';
import { START_LINK_COPY } from './start-link-copy';
import { START_LINK_STYLE } from './start-link-style';

const VIEWPORT_CONTENT = 'width=device-width, initial-scale=1';

function renderSection(input: { locale: OwnerLocale }): string {
  const { htmlLanguage, direction, unavailableTitle, unavailableBody } = START_LINK_COPY[input.locale];
  return `<section lang="${htmlLanguage}" dir="${direction}"><h1>${unavailableTitle}</h1><p>${unavailableBody}</p></section>`;
}

export function renderStartUnavailablePage(input: { locale: OwnerLocale }): string {
  const { htmlLanguage, direction, unavailableTitle } = START_LINK_COPY[input.locale];
  const otherLocales = Object.values(OwnerLocale).filter((locale) => locale !== input.locale);
  const sections = [input.locale, ...otherLocales].map((locale) => renderSection({ locale })).join('');
  return `<!doctype html><html lang="${htmlLanguage}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="${VIEWPORT_CONTENT}"><title>${unavailableTitle}</title><style>${START_LINK_STYLE}</style></head><body>${sections}</body></html>`;
}

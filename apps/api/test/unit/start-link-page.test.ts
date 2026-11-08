import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { START_LINK_COPY } from '../../src/routes/start-link-copy';
import { renderStartUnavailablePage } from '../../src/routes/start-link-page';

const LOCALES = Object.values(OwnerLocale);
const FORBIDDEN_MARKUP = ['<script', '<style', '<link', 'style=', 'wa.me', 'href=', 'src=', 'http'];

describe('renderStartUnavailablePage', () => {
  it.each(LOCALES)('carries the copy of both locales when %s is asked for', (locale) => {
    const page = renderStartUnavailablePage({ locale });
    LOCALES.forEach((candidate) => {
      expect(page).toContain(START_LINK_COPY[candidate].unavailableTitle);
      expect(page).toContain(START_LINK_COPY[candidate].unavailableBody);
    });
  });

  it.each(LOCALES)('puts the copy of %s first and declares its language', (locale) => {
    const page = renderStartUnavailablePage({ locale });
    const other = LOCALES.find((candidate) => candidate !== locale) as OwnerLocale;
    expect(page.indexOf(START_LINK_COPY[locale].unavailableBody)).toBeLessThan(page.indexOf(START_LINK_COPY[other].unavailableBody));
    expect(page).toContain(`<html lang="${START_LINK_COPY[locale].htmlLanguage}">`);
  });

  it.each(FORBIDDEN_MARKUP)('never contains %s', (markup) => {
    LOCALES.forEach((locale) => {
      expect(renderStartUnavailablePage({ locale }).toLowerCase()).not.toContain(markup);
    });
  });
});

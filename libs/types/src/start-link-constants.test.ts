import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_PUBLIC_ORIGIN,
  START_LINK,
  START_LINK_LANGUAGE_PARAMETER,
  START_LINK_PATH,
  START_PREFILLED_TEXT,
  WHATSAPP_LINK_ORIGIN,
  WHATSAPP_LINK_TEXT_PARAMETER,
} from './constants';
import { HttpStatus, OwnerLocale } from './enums';

describe('start link constants', () => {
  it('names the production start link', () => {
    expect(START_LINK_PATH).toBe('/start');
    expect(START_LINK).toBe('https://mcp.zapbip.com/start');
    expect(START_LINK).toBe(`${PRODUCTION_PUBLIC_ORIGIN}${START_LINK_PATH}`);
  });

  it('names the language and text parameters and the WhatsApp link origin', () => {
    expect(START_LINK_LANGUAGE_PARAMETER).toBe('lang');
    expect(WHATSAPP_LINK_TEXT_PARAMETER).toBe('text');
    expect(WHATSAPP_LINK_ORIGIN).toBe('https://wa.me');
  });

  it('answers a redirect with 302', () => {
    expect(HttpStatus.Found).toBe(302);
  });

  it.each(Object.values(OwnerLocale))('has a non-empty prefilled text for %s', (locale) => {
    expect(START_PREFILLED_TEXT[locale]).not.toBe('');
  });
});

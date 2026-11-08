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

const COMMAND_WORDS = [
  'novo agente',
  'new agent',
  'agentes',
  'agents',
  'revogar',
  'revoke',
  'girar',
  'rotate',
  'ajuda',
  'help',
  'menu',
  'apagar conta',
  'delete account',
  'apagar conta definitivamente',
  'delete account permanently',
];

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

  it.each(Object.values(OwnerLocale))('has a prefilled text for %s that is no bare-word command', (locale) => {
    const text = START_PREFILLED_TEXT[locale];
    expect(text).not.toBe('');
    expect(COMMAND_WORDS).not.toContain(text.trim().toLowerCase());
  });
});

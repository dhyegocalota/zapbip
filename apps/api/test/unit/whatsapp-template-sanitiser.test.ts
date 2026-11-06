import { describe, expect, it } from 'vitest';
import { assertTemplateBodyHasFixedWords, sanitiseTemplateParameter } from '../../src/adapters/whatsapp/template-sanitiser';
import { WHATSAPP_TEMPLATE_BODIES } from '../../src/adapters/whatsapp/whatsapp-templates';

const FALLBACK = 'uma mensagem';

function sanitise(value: string, fallback = FALLBACK): string {
  return sanitiseTemplateParameter({ value, fallback });
}

describe('sanitiseTemplateParameter', () => {
  it('AU-106 turns a line break into a space', () => {
    expect(sanitise('linha\numa')).toBe('linha uma');
  });

  it('AU-107 turns a tab into a space', () => {
    expect(sanitise('a\tb')).toBe('a b');
  });

  it('AU-108 trims and collapses runs of spaces', () => {
    expect(sanitise('  a     b  ')).toBe('a b');
  });

  it('AU-109 returns the fallback for whitespace only', () => {
    expect(sanitise('   \n  ', 'a message')).toBe('a message');
  });

  it('AU-110 returns the fallback it was given for an empty value', () => {
    expect(sanitise('')).toBe(FALLBACK);
    expect(sanitise('', 'outro')).toBe('outro');
  });

  it('AU-111 cuts a long value to 60 characters', () => {
    expect(sanitise('a'.repeat(61))).toBe('a'.repeat(60));
  });

  it('AU-112 never leaves a lone surrogate when cutting', () => {
    const value = `${'a'.repeat(59)}👋 ok`;
    const result = sanitise(value);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result).not.toMatch(/\p{Surrogate}/u);
    expect(result).toBe('a'.repeat(59));
  });

  it('keeps accents and an emoji that fits', () => {
    expect(sanitise('ação 👋 ok')).toBe('ação 👋 ok');
  });

  it('does not end on a space after the cut', () => {
    expect(sanitise(`${'a'.repeat(59)} b`)).toBe('a'.repeat(59));
  });
});

describe('assertTemplateBodyHasFixedWords', () => {
  it('AU-113 refuses a parameter at the start', () => {
    expect(() => assertTemplateBodyHasFixedWords({ body: '{{1}} tem uma pergunta' })).toThrow();
  });

  it('AU-114 refuses a parameter at the end', () => {
    expect(() => assertTemplateBodyHasFixedWords({ body: 'Ola {{1}}' })).toThrow();
  });

  it('AU-115 accepts fixed words around the parameter', () => {
    expect(() => assertTemplateBodyHasFixedWords({ body: 'Você tem {{1}} para ler' })).not.toThrow();
  });

  it('accepts every registered template body', () => {
    Object.values(WHATSAPP_TEMPLATE_BODIES).forEach((bodies) =>
      Object.values(bodies).forEach((body) => expect(() => assertTemplateBodyHasFixedWords({ body })).not.toThrow()),
    );
  });
});

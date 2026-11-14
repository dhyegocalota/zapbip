import { CommandKind, OwnerLocale, START_PREFILLED_TEXT } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { COMMAND_WORDS } from './command-words';
import { commandWordLocaleOf } from './command';
import { ownerLanguageOfValue, ownerLocaleOf } from './owner-locale';

const US_WA_ID = '14155550100';
const GERMAN_WA_ID = '4915112345678';
const SPANISH_WA_ID = '34612345678';

function wordsOf(input: { kind: CommandKind; locale: OwnerLocale }): string {
  return COMMAND_WORDS.find((entry) => entry.kind === input.kind && entry.locale === input.locale)!.words;
}

describe('the language of a new owner by calling code', () => {
  it.each([
    ['5511999990000', OwnerLocale.PortugueseBrazil],
    ['351912345678', OwnerLocale.PortugueseBrazil],
    ['34612345678', OwnerLocale.Spanish],
    ['5215512345678', OwnerLocale.Spanish],
    ['5491112345678', OwnerLocale.Spanish],
    ['573001234567', OwnerLocale.Spanish],
    ['4915112345678', OwnerLocale.German],
    ['436641234567', OwnerLocale.German],
    ['41791234567', OwnerLocale.German],
    ['33612345678', OwnerLocale.French],
    ['32470123456', OwnerLocale.French],
    ['352621123456', OwnerLocale.French],
    ['81901234567', OwnerLocale.Japanese],
    ['821012345678', OwnerLocale.Korean],
    ['8613812345678', OwnerLocale.ChineseSimplified],
  ])('reads %s as %s when the text says nothing', (waId, locale) => {
    expect(ownerLocaleOf({ waId, writtenText: 'ok' })).toBe(locale);
  });

  it.each(['14155550100', '447911123456', '85291234567', '886912345678', '61412345678', '2348012345678'])(
    'falls to English for %s, whose language has no copy',
    (waId) => {
      expect(ownerLocaleOf({ waId, writtenText: null })).toBe(OwnerLocale.EnglishUs);
    },
  );

  it('keeps India (91) in English, because Hindi is not the first language across the country', () => {
    expect(ownerLocaleOf({ waId: '919876543210', writtenText: null })).toBe(OwnerLocale.EnglishUs);
  });

  it('prefers the longest calling code, so 351 is Portuguese and 3 alone is nothing', () => {
    expect(ownerLocaleOf({ waId: '351900000000', writtenText: null })).toBe(OwnerLocale.PortugueseBrazil);
    expect(ownerLocaleOf({ waId: '3999999999', writtenText: null })).toBe(OwnerLocale.EnglishUs);
  });

  it.each(['', 'abc', '+34612345678'])('falls to English for the malformed %j', (waId) => {
    expect(ownerLocaleOf({ waId, writtenText: null })).toBe(OwnerLocale.EnglishUs);
  });
});

describe('the language of a new owner by the text they write', () => {
  it.each(Object.values(OwnerLocale))('reads the start link text of %s as that language from any number', (locale) => {
    expect(ownerLocaleOf({ waId: US_WA_ID, writtenText: START_PREFILLED_TEXT[locale] })).toBe(locale);
  });

  it('reads the start link text followed by the invite code as its language', () => {
    expect(ownerLocaleOf({ waId: US_WA_ID, writtenText: `${START_PREFILLED_TEXT[OwnerLocale.Spanish]} zb_code` })).toBe(
      OwnerLocale.Spanish,
    );
  });

  it.each([
    [OwnerLocale.Spanish, CommandKind.Help],
    [OwnerLocale.German, CommandKind.Help],
    [OwnerLocale.Japanese, CommandKind.Help],
    [OwnerLocale.French, CommandKind.CreateAgent],
    [OwnerLocale.Korean, CommandKind.ListAgents],
  ])('reads a %s command word from a US number as %s', (locale, kind) => {
    expect(ownerLocaleOf({ waId: US_WA_ID, writtenText: wordsOf({ kind, locale }) })).toBe(locale);
  });

  it('reads a command with a name by its command word', () => {
    expect(
      ownerLocaleOf({ waId: US_WA_ID, writtenText: `${wordsOf({ kind: CommandKind.CreateAgent, locale: OwnerLocale.Spanish })} helper` }),
    ).toBe(OwnerLocale.Spanish);
  });

  it('prefers the text over the calling code', () => {
    expect(ownerLocaleOf({ waId: GERMAN_WA_ID, writtenText: wordsOf({ kind: CommandKind.Help, locale: OwnerLocale.Spanish }) })).toBe(
      OwnerLocale.Spanish,
    );
    expect(ownerLocaleOf({ waId: SPANISH_WA_ID, writtenText: wordsOf({ kind: CommandKind.Help, locale: OwnerLocale.Japanese }) })).toBe(
      OwnerLocale.Japanese,
    );
  });

  it.each([
    ['こんにちは', OwnerLocale.Japanese],
    ['안녕하세요', OwnerLocale.Korean],
    ['مرحبا بك', OwnerLocale.Arabic],
    ['नमस्ते', OwnerLocale.Hindi],
  ])('reads the script of %j as %s', (writtenText, locale) => {
    expect(ownerLocaleOf({ waId: US_WA_ID, writtenText })).toBe(locale);
  });

  it('falls to the calling code for a word that two languages share', () => {
    expect(commandWordLocaleOf({ text: 'menu' })).toBeNull();
    expect(ownerLocaleOf({ waId: SPANISH_WA_ID, writtenText: 'menu' })).toBe(OwnerLocale.Spanish);
    expect(ownerLocaleOf({ waId: US_WA_ID, writtenText: 'menu' })).toBe(OwnerLocale.EnglishUs);
  });

  it('falls to the calling code for Latin text that is not a command word', () => {
    expect(ownerLocaleOf({ waId: GERMAN_WA_ID, writtenText: 'Hallo, ich möchte einen Agenten verbinden' })).toBe(OwnerLocale.German);
  });

  it('falls to English for Chinese text without kana, which reads the same in Japanese', () => {
    expect(ownerLocaleOf({ waId: US_WA_ID, writtenText: '请帮助我' })).toBe(OwnerLocale.EnglishUs);
  });

  it('finds the command words of each language only in that language', () => {
    expect(commandWordLocaleOf({ text: wordsOf({ kind: CommandKind.RevokeAgent, locale: OwnerLocale.French }) })).toBe(OwnerLocale.French);
    expect(commandWordLocaleOf({ text: 'olá tudo bem' })).toBeNull();
  });
});

describe('the language an owner asks for', () => {
  it.each([
    ['en', OwnerLocale.EnglishUs],
    ['EN-us', OwnerLocale.EnglishUs],
    ['pt', OwnerLocale.PortugueseBrazil],
    ['pt-br', OwnerLocale.PortugueseBrazil],
    ['pt_BR', OwnerLocale.PortugueseBrazil],
    ['es', OwnerLocale.Spanish],
    ['de', OwnerLocale.German],
    ['fr', OwnerLocale.French],
    ['ja', OwnerLocale.Japanese],
    ['ko', OwnerLocale.Korean],
    ['zh', OwnerLocale.ChineseSimplified],
    ['zh-cn', OwnerLocale.ChineseSimplified],
    [' ZH_CN ', OwnerLocale.ChineseSimplified],
    ['ar', OwnerLocale.Arabic],
    ['hi', OwnerLocale.Hindi],
    [' HI ', OwnerLocale.Hindi],
  ])('reads %j as %s', (value, locale) => {
    expect(ownerLanguageOfValue({ value })).toBe(locale);
  });

  it.each(['', 'xx', 'zh-tw', 'english', 'it', 'hindi', 'हिन्दी'])('refuses %j', (value) => {
    expect(ownerLanguageOfValue({ value })).toBeNull();
  });
});

import { CommandKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { parseAccountCommand } from './command';
import { COMMAND_WORDS, MENU_COMMAND_KINDS } from './command-words';

const LOCALES = Object.values(OwnerLocale);
const SPOKEN_KINDS = Object.values(CommandKind).filter((kind) => kind !== CommandKind.Unknown);
const COMMAND_PHRASE = (words: string): { text: string; isQuoting: boolean; listReplyId: null } => ({
  text: words,
  isQuoting: false,
  listReplyId: null,
});
const ORDINARY_MESSAGES = [
  'ok',
  'yes',
  'no',
  'thanks',
  'sim',
  'não',
  'obrigado',
  'sí',
  'hola',
  'gracias',
  'ja',
  'nein',
  'danke',
  'oui',
  'non',
  'merci',
  'はい',
  'いいえ',
  'ありがとう',
  '네',
  '아니요',
  '감사합니다',
  '好的',
  '谢谢',
  '是',
  'merge it',
  'deploy now',
  'sí, hazlo',
  '登录失败了吗',
  'agents are great',
];

describe('the command words of the eight languages', () => {
  it.each(LOCALES)('gives %s a word for every command', (locale) => {
    const kinds = COMMAND_WORDS.filter((entry) => entry.locale === locale).map((entry) => entry.kind);
    expect(SPOKEN_KINDS.filter((kind) => !kinds.includes(kind))).toEqual([]);
  });

  it('gives the language command a word of its own in every language', () => {
    const words = LOCALES.map(
      (locale) => COMMAND_WORDS.find((entry) => entry.kind === CommandKind.SetLanguage && entry.locale === locale)!.words,
    );
    expect(new Set(words).size).toBe(LOCALES.length);
  });

  it('never gives one text two kinds, or two languages for different kinds', () => {
    const kindsOfText = new Map<string, Set<CommandKind>>();
    COMMAND_WORDS.forEach((entry) => kindsOfText.set(entry.words, new Set([...(kindsOfText.get(entry.words) ?? []), entry.kind])));
    expect([...kindsOfText].filter(([, kinds]) => kinds.size > 1).map(([words]) => words)).toEqual([]);
  });

  it('lets a text answer in more than one language only when it is the shared menu or the same word', () => {
    const localesOfText = new Map<string, OwnerLocale[]>();
    COMMAND_WORDS.forEach((entry) => localesOfText.set(entry.words, [...(localesOfText.get(entry.words) ?? []), entry.locale]));
    const shared = [...localesOfText].filter(([, locales]) => locales.length > 1).map(([words]) => words);
    expect(shared.sort()).toEqual(['menu']);
  });

  it('never makes a word the start of another command of the same kind family by accident', () => {
    const takingName = COMMAND_WORDS.filter((entry) => entry.takesName);
    const exact = COMMAND_WORDS.filter((entry) => !entry.takesName);
    expect(exact.filter((word) => takingName.some((taking) => word.words.startsWith(`${taking.words} `)))).toEqual([]);
  });

  it.each(COMMAND_WORDS.filter((entry) => !entry.takesName))('reads the whole message "$words" as $kind', ({ words, kind }) => {
    const firstLocale = COMMAND_WORDS.find((entry) => entry.words === words)!.locale;
    expect(parseAccountCommand(COMMAND_PHRASE(words))).toEqual({ kind, rawName: null, locale: firstLocale });
  });

  it.each(COMMAND_WORDS.filter((entry) => entry.takesName))(
    'reads "$words helper" as $kind with the name in $locale',
    ({ words, kind, locale }) => {
      expect(parseAccountCommand(COMMAND_PHRASE(`${words} helper`))).toEqual({ kind, rawName: 'helper', locale });
    },
  );

  it.each(ORDINARY_MESSAGES)('does not read the ordinary message %j as a command', (text) => {
    expect(parseAccountCommand(COMMAND_PHRASE(text))).toBeNull();
  });

  it('keeps the CJK words usable in a longer sentence without turning it into a command', () => {
    expect(parseAccountCommand(COMMAND_PHRASE('ログインできません'))).toBeNull();
    expect(parseAccountCommand(COMMAND_PHRASE('请帮助我'))).toBeNull();
  });
});

describe('the menu', () => {
  it('lists the seven kinds, the language command among them', () => {
    expect(MENU_COMMAND_KINDS).toHaveLength(7);
    expect(MENU_COMMAND_KINDS).toContain(CommandKind.SetLanguage);
  });
});

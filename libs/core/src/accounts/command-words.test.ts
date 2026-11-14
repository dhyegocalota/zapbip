import { CommandKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { COMMAND_WORDS, MENU_COMMAND_KINDS } from './command-words';

const LOCALES = Object.values(OwnerLocale);
const COMMAND_KINDS_WITH_WORDS = Object.values(CommandKind).filter((kind) => kind !== CommandKind.Unknown);

describe('COMMAND_WORDS', () => {
  it.each(COMMAND_KINDS_WITH_WORDS)('gives %s at least one word in every locale', (kind) => {
    const localesOfKind = COMMAND_WORDS.filter((entry) => entry.kind === kind).map((entry) => entry.locale);
    expect(LOCALES.every((locale) => localesOfKind.includes(locale))).toBe(true);
  });

  it('has no word for the unknown command', () => {
    expect(COMMAND_WORDS.some((entry) => entry.kind === CommandKind.Unknown)).toBe(false);
  });

  it('keeps every word lowercase, trimmed and single-spaced', () => {
    expect(COMMAND_WORDS.every((entry) => entry.words === entry.words.trim().replace(/\s+/g, ' ').toLowerCase())).toBe(true);
  });

  it('never repeats a word within one locale', () => {
    const keys = COMMAND_WORDS.map((entry) => `${entry.locale}:${entry.words}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('MENU_COMMAND_KINDS', () => {
  it('lists seven kinds, none of them the confirmation or the unknown command', () => {
    expect(MENU_COMMAND_KINDS).toHaveLength(7);
    expect(MENU_COMMAND_KINDS).not.toContain(CommandKind.ConfirmDeletion);
    expect(MENU_COMMAND_KINDS).not.toContain(CommandKind.Unknown);
  });

  it('lists only kinds that have words', () => {
    const kindsWithWords = COMMAND_WORDS.map((entry) => entry.kind);
    expect(MENU_COMMAND_KINDS.every((kind) => kindsWithWords.includes(kind))).toBe(true);
  });
});

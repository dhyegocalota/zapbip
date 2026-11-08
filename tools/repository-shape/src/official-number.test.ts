import { describe, expect, test } from 'vitest';
import { readRepositoryFile, trackedFiles } from './repository-files';

const PRODUCT_DIRECTORIES = ['apps/', 'libs/', 'scripts/', 'tools/'];
const SHAPE_TESTS_DIRECTORY = 'tools/repository-shape/';
const BINARY_BYTE = '\u0000';
const OFFICIAL_NUMBER_PATTERN = /official (WhatsApp )?number|número oficial|OFFICIAL_(WHATSAPP_)?NUMBER|OFFICIAL_NUMBER_UNSET/i;

function filesNamingTheOfficialNumber(): string[] {
  return trackedFiles()
    .filter((path) => PRODUCT_DIRECTORIES.some((directory) => path.startsWith(directory)))
    .filter((path) => !path.startsWith(SHAPE_TESTS_DIRECTORY))
    .filter((path) => {
      const text = readRepositoryFile(path);
      return !text.includes(BINARY_BYTE) && OFFICIAL_NUMBER_PATTERN.test(text);
    });
}

describe('the official number is gone', () => {
  test('the pattern catches the constants and both languages of the old wording', () => {
    const wordings = [
      'OFFICIAL_WHATSAPP_NUMBER',
      'OFFICIAL_NUMBER_UNSET',
      'zapbip official number',
      'the official WhatsApp number',
      'número oficial',
    ];
    expect(wordings.filter((wording) => !OFFICIAL_NUMBER_PATTERN.test(wording))).toEqual([]);
  });

  test('the official WhatsApp Cloud API wording is allowed', () => {
    expect(OFFICIAL_NUMBER_PATTERN.test('the official WhatsApp Cloud API')).toBe(false);
  });

  test('no product file names the official number', () => {
    expect(filesNamingTheOfficialNumber()).toEqual([]);
  });
});

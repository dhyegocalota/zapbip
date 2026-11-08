import { posix } from 'node:path';
import { GENERATED_FOLDER } from './paths';

const KEBAB_SEGMENT_PATTERN = /-([a-z0-9])/g;
const ID_SEPARATOR = '-';
const DISPLAY_SEPARATOR = ' ';

export function camelCaseOf(input: { id: string }): string {
  return input.id.replace(KEBAB_SEGMENT_PATTERN, (_segment, letter: string) => letter.toUpperCase());
}

export function generatedModulePathOf(input: { folder: string; file: string }): string {
  return posix.relative(GENERATED_FOLDER, posix.join(input.folder, input.file));
}

export function pascalCaseOf(input: { id: string }): string {
  const camelCase = camelCaseOf(input);
  return `${camelCase.charAt(0).toUpperCase()}${camelCase.slice(1)}`;
}

export function displayNameOf(input: { id: string }): string {
  return input.id
    .split(ID_SEPARATOR)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(DISPLAY_SEPARATOR);
}

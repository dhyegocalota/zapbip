import { posix } from 'node:path';
import { GENERATED_FOLDER } from './paths';

export { camelCaseOf, constantNameOf, pascalCaseOf } from '../src/identifiers';

const ID_SEPARATOR = '-';
const DISPLAY_SEPARATOR = ' ';

export function generatedModulePathOf(input: { folder: string; file: string }): string {
  return posix.relative(GENERATED_FOLDER, posix.join(input.folder, input.file));
}

export function displayNameOf(input: { id: string }): string {
  return input.id
    .split(ID_SEPARATOR)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(DISPLAY_SEPARATOR);
}

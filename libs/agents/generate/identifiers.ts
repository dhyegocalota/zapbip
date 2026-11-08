import { posix } from 'node:path';
import { GENERATED_FOLDER } from './paths';

const KEBAB_SEGMENT_PATTERN = /-([a-z0-9])/g;

export function camelCaseOf(input: { id: string }): string {
  return input.id.replace(KEBAB_SEGMENT_PATTERN, (_segment, letter: string) => letter.toUpperCase());
}

export function generatedModulePathOf(input: { folder: string; file: string }): string {
  return posix.relative(GENERATED_FOLDER, posix.join(input.folder, input.file));
}

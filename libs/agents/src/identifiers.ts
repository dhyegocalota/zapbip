const KEBAB_SEGMENT_PATTERN = /-([a-z0-9])/g;
const ID_SEPARATOR = '-';
const CONSTANT_SEPARATOR = '_';

export function camelCaseOf(input: { id: string }): string {
  return input.id.replace(KEBAB_SEGMENT_PATTERN, (_segment, letter: string) => letter.toUpperCase());
}

export function pascalCaseOf(input: { id: string }): string {
  const camelCase = camelCaseOf(input);
  return `${camelCase.charAt(0).toUpperCase()}${camelCase.slice(1)}`;
}

export function constantNameOf(input: { id: string }): string {
  return input.id.toUpperCase().replaceAll(ID_SEPARATOR, CONSTANT_SEPARATOR);
}

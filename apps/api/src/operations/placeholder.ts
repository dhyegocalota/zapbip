import { PLACEHOLDER_VALUE_PREFIX } from './constants';

function normalized(input: { text: string }): string {
  return input.text.toLowerCase().replaceAll('-', '_');
}

export function isPlaceholderValue(input: { value: string }): boolean {
  return normalized({ text: input.value }).startsWith(normalized({ text: PLACEHOLDER_VALUE_PREFIX }));
}

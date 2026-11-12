import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../contract/constants';

const NORMALIZATION_FORM = 'NFKC';

export function normalizePassword(input: { value: string }): string {
  return input.value.normalize(NORMALIZATION_FORM);
}

export function isPasswordLengthAllowed(input: { password: string }): boolean {
  const length = Array.from(normalizePassword({ value: input.password })).length;
  return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH;
}

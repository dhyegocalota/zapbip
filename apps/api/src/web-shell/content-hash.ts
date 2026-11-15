const HASH_MULTIPLIER = 31;
const HASH_MODULUS = 2 ** 32;
const HEXADECIMAL_RADIX = 16;

export function contentHashOf(input: { text: string }): string {
  const hash = Array.from(input.text).reduce(
    (current, character) => (current * HASH_MULTIPLIER + character.charCodeAt(0)) % HASH_MODULUS,
    0,
  );
  return hash.toString(HEXADECIMAL_RADIX);
}

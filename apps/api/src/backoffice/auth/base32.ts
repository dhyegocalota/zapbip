const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BITS_PER_CHARACTER = 5;
const BITS_PER_BYTE = 8;
const CHARACTER_MASK = 0b11111;
const BYTE_MASK = 0xff;
const PADDING = '=';

export function encodeBase32(input: { bytes: Uint8Array }): string {
  const bitString = Array.from(input.bytes, (byte) => byte.toString(2).padStart(BITS_PER_BYTE, '0')).join('');
  const groupCount = Math.ceil(bitString.length / BITS_PER_CHARACTER);
  return Array.from({ length: groupCount }, (_, index) => bitString.slice(index * BITS_PER_CHARACTER, (index + 1) * BITS_PER_CHARACTER))
    .map((group) => ALPHABET[parseInt(group.padEnd(BITS_PER_CHARACTER, '0'), 2)])
    .join('');
}

export function decodeBase32(input: { value: string }): Uint8Array {
  const characters = input.value.toUpperCase().replaceAll(PADDING, '').split('');
  const bits = characters.reduce<{ buffer: number; length: number; bytes: number[] }>(
    (state, character) => {
      const index = ALPHABET.indexOf(character);
      if (index === -1) throw new Error('invalid base32 character');
      const buffer = (state.buffer << BITS_PER_CHARACTER) | (index & CHARACTER_MASK);
      const length = state.length + BITS_PER_CHARACTER;
      if (length < BITS_PER_BYTE) return { buffer, length, bytes: state.bytes };
      const remaining = length - BITS_PER_BYTE;
      return { buffer: buffer & ((1 << remaining) - 1), length: remaining, bytes: [...state.bytes, (buffer >> remaining) & BYTE_MASK] };
    },
    { buffer: 0, length: 0, bytes: [] },
  );
  return Uint8Array.from(bits.bytes);
}

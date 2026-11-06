export function encodeBase64Url(input: { bytes: Uint8Array }): string {
  return Buffer.from(input.bytes).toString('base64url');
}

export function decodeBase64Url(input: { value: string }): Uint8Array {
  return Buffer.from(input.value, 'base64url');
}

export function encodeHex(input: { bytes: Uint8Array }): string {
  return Buffer.from(input.bytes).toString('hex');
}

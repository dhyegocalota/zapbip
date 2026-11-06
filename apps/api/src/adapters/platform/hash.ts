export function hashConnectionSecret(input: { secret: string }): Promise<string> {
  void input;
  throw new Error('hashConnectionSecret is not implemented');
}

export function sha256Hex(input: { value: string }): Promise<string> {
  void input;
  throw new Error('sha256Hex is not implemented');
}

export function sha256Base64(input: { bytes: ArrayBuffer }): Promise<string> {
  void input;
  throw new Error('sha256Base64 is not implemented');
}

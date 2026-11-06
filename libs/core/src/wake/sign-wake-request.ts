export type SignWakeRequestInput = { timestampSeconds: number; body: string };

export function signWakeRequest(input: SignWakeRequestInput): string {
  void input;
  throw new Error('signWakeRequest is not implemented');
}

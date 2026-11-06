export type SignWakeRequestInput = { timestampSeconds: number; body: string };

export function signWakeRequest(input: SignWakeRequestInput): string {
  return `${input.timestampSeconds}.${input.body}`;
}

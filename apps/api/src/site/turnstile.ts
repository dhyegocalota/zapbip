export enum TurnstileVerdict {
  Accepted = 'accepted',
  Refused = 'refused',
  Unavailable = 'unavailable',
}

export async function verifyTurnstileToken(input: {
  secret: string;
  token: string;
  expectedHostname: string;
  fetchImplementation: typeof fetch;
}): Promise<TurnstileVerdict> {
  throw new Error(`verifyTurnstileToken is not implemented ${input.expectedHostname}`);
}

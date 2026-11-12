export async function verifyTurnstileToken(input: {
  secret: string;
  token: string;
  expectedHostname: string;
  fetchImplementation: typeof fetch;
}): Promise<boolean> {
  throw new Error(`verifyTurnstileToken is not implemented ${input.expectedHostname}`);
}

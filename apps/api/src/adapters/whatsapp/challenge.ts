export function answerWebhookChallenge(input: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
  expectedToken: string;
}): Promise<{ status: number; body: string | null }> {
  void input;
  throw new Error('answerWebhookChallenge is not implemented');
}

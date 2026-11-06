export function verifyWebhookSignature(input: {
  appSecret: string;
  rawBody: ArrayBuffer;
  signatureHeader: string | null;
}): Promise<boolean> {
  void input;
  throw new Error('verifyWebhookSignature is not implemented');
}

export const SIGNATURE_HEADER = 'X-Hub-Signature-256';

export type SignedWebhookInput = {
  appSecret: string;
  ownerWaId: string;
  phoneNumberId: string;
  text: string;
  nonce: string;
  timestamp: string;
};

export type SignedWebhookPost = { body: string; headers: Record<string, string> };

export function buildSignedWebhookPost(input: SignedWebhookInput): SignedWebhookPost {
  void input;
  throw new Error('buildSignedWebhookPost is not implemented');
}

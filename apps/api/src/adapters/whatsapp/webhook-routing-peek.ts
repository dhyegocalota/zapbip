export type WebhookRouting = { phoneNumberIds: string[]; wabaIds: string[] };

export function peekWebhookRouting(_input: { text: string }): WebhookRouting | null {
  throw new Error('peekWebhookRouting is not implemented');
}

import type { Bindings } from '../../contract/env';

export type WebhookEnvironment = {
  verifyToken: string;
};

export type WhatsAppEnvironment = WebhookEnvironment & {
  graphBaseUrl: string;
};

type WhatsAppBindingName = Extract<keyof Bindings, `WHATSAPP_${string}`> | 'META_APP_SECRET';

function requireBinding(input: { env: Bindings; name: WhatsAppBindingName }): string {
  const value = input.env[input.name];
  const isPresent = value !== undefined && value.trim().length > 0;
  if (isPresent) return value;
  throw new Error(`${input.name} is not set`);
}

export function readWebhookEnvironment(input: { env: Bindings }): WebhookEnvironment {
  return { verifyToken: requireBinding({ env: input.env, name: 'WHATSAPP_VERIFY_TOKEN' }) };
}

export function readMetaAppSecret(input: { env: Bindings }): string {
  return requireBinding({ env: input.env, name: 'META_APP_SECRET' });
}

export function readWhatsAppEnvironment(input: { env: Bindings }): WhatsAppEnvironment {
  const { env } = input;
  return {
    ...readWebhookEnvironment({ env }),
    graphBaseUrl: requireBinding({ env, name: 'WHATSAPP_GRAPH_BASE_URL' }),
  };
}

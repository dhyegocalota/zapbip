import type { Bindings } from '../../contract/env';

export type WhatsAppEnvironment = {
  graphBaseUrl: string;
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
};

type WhatsAppBindingName = Extract<keyof Bindings, 'META_APP_SECRET' | `WHATSAPP_${string}`>;

function requireBinding(input: { env: Bindings; name: WhatsAppBindingName }): string {
  const value = input.env[input.name];
  if (value !== undefined && value.length > 0) return value;
  throw new Error(`${input.name} is not set`);
}

export function readWhatsAppEnvironment(input: { env: Bindings }): WhatsAppEnvironment {
  const { env } = input;
  return {
    graphBaseUrl: requireBinding({ env, name: 'WHATSAPP_GRAPH_BASE_URL' }),
    accessToken: requireBinding({ env, name: 'WHATSAPP_ACCESS_TOKEN' }),
    phoneNumberId: requireBinding({ env, name: 'WHATSAPP_PHONE_NUMBER_ID' }),
    verifyToken: requireBinding({ env, name: 'WHATSAPP_VERIFY_TOKEN' }),
    appSecret: requireBinding({ env, name: 'META_APP_SECRET' }),
  };
}

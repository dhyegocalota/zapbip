import type { Bindings } from '../../contract/env';

export type WhatsAppEnvironment = {
  graphBaseUrl: string;
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
};

export function readWhatsAppEnvironment(input: { env: Bindings }): WhatsAppEnvironment {
  void input;
  throw new Error('readWhatsAppEnvironment is not implemented');
}

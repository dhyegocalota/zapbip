import type { Bindings } from '../contract/env';
import type { EmailDelivery, EmailSender } from './email-sender';

export function emailDeliveryOf(_input: { env: Bindings }): EmailDelivery {
  throw new Error('emailDeliveryOf is not implemented');
}

export function createEmailSender(_input: { env: Bindings; fetchImplementation: typeof fetch }): EmailSender {
  throw new Error('createEmailSender is not implemented');
}

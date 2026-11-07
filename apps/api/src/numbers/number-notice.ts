import { createGraphClient } from '../adapters/whatsapp/graph-client';
import { MESSAGING_PRODUCT, RECIPIENT_TYPE } from '../adapters/whatsapp/outbound-builders';
import { readWhatsAppEnvironment } from '../adapters/whatsapp/read-whatsapp-env';
import type { Bindings } from '../contract/env';
import type { NumberRegistry } from './number-registry';

const TEXT_MESSAGE_TYPE = 'text';

export async function sendNumberNotice(input: {
  bindings: Bindings;
  registry: NumberRegistry;
  numberId: string;
  waId: string;
  text: string;
}): Promise<void> {
  const { bindings, registry, numberId, waId, text } = input;
  const number = await registry.openForInbound({ numberId });
  const graph = createGraphClient({
    baseUrl: readWhatsAppEnvironment({ env: bindings }).graphBaseUrl,
    accessToken: number.accessToken,
    developmentMediaOrigin: null,
    fetcher: fetch,
  });
  await graph.post({
    path: `/${number.phoneNumberId}/messages`,
    body: { messaging_product: MESSAGING_PRODUCT, recipient_type: RECIPIENT_TYPE, to: waId, type: TEXT_MESSAGE_TYPE, text: { body: text } },
  });
}

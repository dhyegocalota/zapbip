import { createHmac } from 'node:crypto';

export const SIGNATURE_HEADER = 'X-Hub-Signature-256';

const SIGNATURE_PREFIX = 'sha256=';
const SIGNATURE_ALGORITHM = 'sha256';
const JSON_CONTENT_TYPE = 'application/json';
const WEBHOOK_OBJECT = 'whatsapp_business_account';
const MESSAGES_FIELD = 'messages';
const MESSAGING_PRODUCT = 'whatsapp';
const SMOKE_BUSINESS_ACCOUNT_ID = 'smoke-business-account';
const SMOKE_DISPLAY_PHONE_NUMBER = '15550000000';
const SMOKE_OWNER_NAME = 'Smoke Owner';
const MESSAGE_ID_PREFIX = 'wamid.';
const TEXT_MESSAGE_TYPE = 'text';

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
  const body = JSON.stringify({
    object: WEBHOOK_OBJECT,
    entry: [
      {
        id: SMOKE_BUSINESS_ACCOUNT_ID,
        changes: [
          {
            field: MESSAGES_FIELD,
            value: {
              messaging_product: MESSAGING_PRODUCT,
              metadata: { display_phone_number: SMOKE_DISPLAY_PHONE_NUMBER, phone_number_id: input.phoneNumberId },
              contacts: [{ profile: { name: SMOKE_OWNER_NAME }, wa_id: input.ownerWaId }],
              messages: [
                {
                  from: input.ownerWaId,
                  id: `${MESSAGE_ID_PREFIX}${input.nonce}`,
                  timestamp: input.timestamp,
                  type: TEXT_MESSAGE_TYPE,
                  text: { body: input.text },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const digest = createHmac(SIGNATURE_ALGORITHM, input.appSecret).update(body).digest('hex');
  return { body, headers: { 'Content-Type': JSON_CONTENT_TYPE, [SIGNATURE_HEADER]: `${SIGNATURE_PREFIX}${digest}` } };
}

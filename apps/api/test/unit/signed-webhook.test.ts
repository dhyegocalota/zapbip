import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildSignedWebhookPost, SIGNATURE_HEADER } from '../../src/operations/signed-webhook';

const INPUT = {
  appSecret: 'app-secret',
  ownerWaId: '5511999990000',
  phoneNumberId: 'PNID',
  text: '@smoke n1',
  nonce: 'n1',
  timestamp: '1762387200',
};

type ParsedBody = {
  object: string;
  entry: {
    changes: {
      field: string;
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string };
        contacts: { wa_id: string }[];
        messages: { from: string; id: string; timestamp: string; type: string; text: { body: string } }[];
      };
    }[];
  }[];
};

describe('signed webhook post', () => {
  const post = buildSignedWebhookPost(INPUT);
  const parsed = JSON.parse(post.body) as ParsedBody;
  const [change] = parsed.entry[0]!.changes;
  const [message] = change!.value.messages;

  it('carries the Meta text message shape', () => {
    expect(parsed.object).toBe('whatsapp_business_account');
    expect(change!.field).toBe('messages');
    expect(change!.value.messaging_product).toBe('whatsapp');
    expect(change!.value.metadata.phone_number_id).toBe('PNID');
    expect(change!.value.contacts[0]!.wa_id).toBe('5511999990000');
    expect(message).toEqual({
      from: '5511999990000',
      id: 'wamid.n1',
      timestamp: '1762387200',
      type: 'text',
      text: { body: '@smoke n1' },
    });
  });

  it('signs the exact body bytes with the app secret, lowercase hexadecimal', () => {
    const digest = createHmac('sha256', INPUT.appSecret).update(post.body).digest('hex');
    expect(post.headers[SIGNATURE_HEADER]).toBe(`sha256=${digest}`);
  });

  it('declares a JSON content type', () => {
    expect(post.headers['Content-Type']).toBe('application/json');
  });

  it('signs differently for a different secret', () => {
    expect(buildSignedWebhookPost({ ...INPUT, appSecret: 'other' }).headers[SIGNATURE_HEADER]).not.toBe(post.headers[SIGNATURE_HEADER]);
  });
});

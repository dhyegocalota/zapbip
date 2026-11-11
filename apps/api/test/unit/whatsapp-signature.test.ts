import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../../src/adapters/whatsapp/signature';
import { WEBHOOK_SIGNATURE_PREFIX } from '../../src/adapters/whatsapp/whatsapp-constants';
import { signatureHeaderOf } from '../fixtures/whatsapp/inbound/signed-webhook';

const APP_SECRET = 'test-app-secret';
const OTHER_SECRET = 'other-secret';
const BODY_TEXT = '{"entry":[{"id":"1","changes":[]}],"object":"whatsapp_business_account"}';
const REORDERED_BODY_TEXT = '{"object":"whatsapp_business_account","entry":[{"id":"1","changes":[]}]}';
const MULTIBYTE_BODY_TEXT = 'Olá 👋 — ação';
const SHORT_DIGEST_LENGTH = 40;
const WHITESPACE_SECRETS = ['   ', '\t\n'];

function bytesOf(input: { text: string }): Uint8Array {
  return new TextEncoder().encode(input.text);
}

function bufferOf(input: { bytes: Uint8Array }): ArrayBuffer {
  return input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength) as ArrayBuffer;
}

async function verifyBody(input: {
  signedText: string;
  checkedBytes?: Uint8Array;
  secret?: string;
  transformHeader?: (header: string) => string | null;
}) {
  const signedBytes = bytesOf({ text: input.signedText });
  const header = await signatureHeaderOf({ appSecret: input.secret === undefined ? APP_SECRET : input.secret, body: signedBytes });
  const signatureHeader = input.transformHeader === undefined ? header : input.transformHeader(header);
  const checkedBytes = input.checkedBytes === undefined ? signedBytes : input.checkedBytes;
  return verifyWebhookSignature({ appSecret: APP_SECRET, rawBody: bufferOf({ bytes: checkedBytes }), signatureHeader });
}

describe('verifyWebhookSignature', () => {
  it('AU-1 accepts the digest of the raw body', async () => {
    expect(await verifyBody({ signedText: BODY_TEXT })).toBe(true);
  });

  it('AU-2 rejects the same digest over a re-serialised body', async () => {
    expect(await verifyBody({ signedText: BODY_TEXT, checkedBytes: bytesOf({ text: REORDERED_BODY_TEXT }) })).toBe(false);
  });

  it('AU-3 rejects a missing header', async () => {
    expect(await verifyBody({ signedText: BODY_TEXT, transformHeader: () => null })).toBe(false);
  });

  it('pin: rejects a valid digest behind another algorithm prefix', async () => {
    const otherPrefix = 'sha512=';
    expect(
      await verifyBody({ signedText: BODY_TEXT, transformHeader: (header) => header.replace(WEBHOOK_SIGNATURE_PREFIX, otherPrefix) }),
    ).toBe(false);
  });

  it('AU-4 rejects the right hex without the prefix', async () => {
    expect(await verifyBody({ signedText: BODY_TEXT, transformHeader: (header) => header.replace(WEBHOOK_SIGNATURE_PREFIX, '') })).toBe(
      false,
    );
  });

  it('AU-5 rejects the digest of another secret', async () => {
    expect(await verifyBody({ signedText: BODY_TEXT, secret: OTHER_SECRET })).toBe(false);
  });

  it('AU-6 rejects a digest shorter than 64 hex characters without throwing', async () => {
    const isValid = await verifyBody({
      signedText: BODY_TEXT,
      transformHeader: (header) => header.slice(0, WEBHOOK_SIGNATURE_PREFIX.length + SHORT_DIGEST_LENGTH),
    });
    expect(isValid).toBe(false);
  });

  it('AU-15 accepts a multibyte body signed over its UTF-8 bytes', async () => {
    expect(await verifyBody({ signedText: MULTIBYTE_BODY_TEXT })).toBe(true);
  });

  it('AU-16 rejects the digest against the body re-encoded through a lossy step', async () => {
    const lossyBytes = bytesOf({ text: new TextDecoder('latin1').decode(bytesOf({ text: MULTIBYTE_BODY_TEXT })) });
    expect(await verifyBody({ signedText: MULTIBYTE_BODY_TEXT, checkedBytes: lossyBytes })).toBe(false);
  });

  it('AU-17 rejects the digest over the body with one trailing newline', async () => {
    expect(await verifyBody({ signedText: BODY_TEXT, checkedBytes: bytesOf({ text: `${BODY_TEXT}\n` }) })).toBe(false);
  });

  it('AU-18 rejects uppercase hex of the right digest', async () => {
    const isValid = await verifyBody({
      signedText: BODY_TEXT,
      transformHeader: (header) => `${WEBHOOK_SIGNATURE_PREFIX}${header.slice(WEBHOOK_SIGNATURE_PREFIX.length).toUpperCase()}`,
    });
    expect(isValid).toBe(false);
  });

  it('rejects a digest that is not hex without throwing', async () => {
    const isValid = await verifyBody({ signedText: BODY_TEXT, transformHeader: () => `${WEBHOOK_SIGNATURE_PREFIX}${'z'.repeat(64)}` });
    expect(isValid).toBe(false);
  });

  it.each(WHITESPACE_SECRETS)('rejects a body signed with the whitespace secret %j', async (whitespaceSecret) => {
    const signedBytes = bytesOf({ text: BODY_TEXT });
    const signatureHeader = await signatureHeaderOf({ appSecret: whitespaceSecret, body: signedBytes });
    const isValid = await verifyWebhookSignature({ appSecret: whitespaceSecret, rawBody: bufferOf({ bytes: signedBytes }), signatureHeader });
    expect(isValid).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { readMetaAppSecret, readWebhookEnvironment, readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import type { Bindings } from '../../src/contract/env';

const COMPLETE = {
  WHATSAPP_GRAPH_BASE_URL: 'http://127.0.0.1:4011',
  WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
};

function envOf(input: Partial<Record<keyof typeof COMPLETE, string>>): Bindings {
  return { ...COMPLETE, ...input } as Bindings;
}

describe('readWhatsAppEnvironment', () => {
  it('AU-114 returns the two values', () => {
    expect(readWhatsAppEnvironment({ env: envOf({}) })).toEqual({
      graphBaseUrl: 'http://127.0.0.1:4011',
      verifyToken: 'test-verify-token',
    });
  });

  it('never reads the development media origin binding', () => {
    const env = { ...envOf({}), WHATSAPP_MEDIA_DOWNLOAD_ORIGIN: 'http://127.0.0.1:4011' } as Bindings;
    expect(readWhatsAppEnvironment({ env })).not.toHaveProperty('developmentMediaOrigin');
  });

  it.each(Object.keys(COMPLETE))('AU-115 throws naming %s when it is missing', (name) => {
    const env = envOf({});
    delete (env as unknown as Record<string, unknown>)[name];
    expect(() => readWhatsAppEnvironment({ env })).toThrow(name);
  });

  it('AU-116 throws naming WHATSAPP_VERIFY_TOKEN when it is empty', () => {
    expect(() => readWhatsAppEnvironment({ env: envOf({ WHATSAPP_VERIFY_TOKEN: '' }) })).toThrow('WHATSAPP_VERIFY_TOKEN');
  });

  it('throws naming WHATSAPP_VERIFY_TOKEN when it is only whitespace', () => {
    expect(() => readWhatsAppEnvironment({ env: envOf({ WHATSAPP_VERIFY_TOKEN: '   ' }) })).toThrow('WHATSAPP_VERIFY_TOKEN');
  });
});

describe('readMetaAppSecret', () => {
  it('throws naming META_APP_SECRET when it is only whitespace', () => {
    const env = { ...envOf({}), META_APP_SECRET: '   ' } as Bindings;
    expect(() => readMetaAppSecret({ env })).toThrow('META_APP_SECRET');
  });
});

describe('readWebhookEnvironment', () => {
  it('AU-117 returns the verify token without the Graph base URL', () => {
    const env = envOf({});
    delete (env as unknown as Record<string, unknown>).WHATSAPP_GRAPH_BASE_URL;
    expect(readWebhookEnvironment({ env })).toEqual({ verifyToken: 'test-verify-token' });
  });
});

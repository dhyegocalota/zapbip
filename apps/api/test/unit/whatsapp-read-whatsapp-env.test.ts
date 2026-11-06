import { describe, expect, it } from 'vitest';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import type { Bindings } from '../../src/contract/env';

const COMPLETE = {
  WHATSAPP_GRAPH_BASE_URL: 'http://127.0.0.1:4011',
  WHATSAPP_ACCESS_TOKEN: 'test-access-token',
  WHATSAPP_PHONE_NUMBER_ID: '1000000000000001',
  WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
  META_APP_SECRET: 'test-app-secret',
};

function envOf(input: Partial<Record<keyof typeof COMPLETE, string>>): Bindings {
  return { ...COMPLETE, ...input } as Bindings;
}

describe('readWhatsAppEnvironment', () => {
  it('AU-114 returns the five values', () => {
    expect(readWhatsAppEnvironment({ env: envOf({}) })).toEqual({
      graphBaseUrl: 'http://127.0.0.1:4011',
      accessToken: 'test-access-token',
      phoneNumberId: '1000000000000001',
      verifyToken: 'test-verify-token',
      appSecret: 'test-app-secret',
    });
  });

  it.each(Object.keys(COMPLETE))('AU-115 throws naming %s when it is missing', (name) => {
    const env = envOf({});
    delete (env as unknown as Record<string, unknown>)[name];
    expect(() => readWhatsAppEnvironment({ env })).toThrow(name);
  });

  it('AU-116 throws naming META_APP_SECRET when it is empty', () => {
    expect(() => readWhatsAppEnvironment({ env: envOf({ META_APP_SECRET: '' }) })).toThrow('META_APP_SECRET');
  });
});

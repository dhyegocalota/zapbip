import { SELF } from 'cloudflare:test';
import { MessageKind } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { testEnv } from '../support/workers-env';
import { findAccounts } from './owner-inbound-fixtures';
import { ORIGIN, seedAccount } from './route-fixtures';

const PHONE_PREFIX = '5511977';
const PHONE_SUFFIX_DIGITS = 6;
const MALFORMED_PHONE = 'not-a-phone';
const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;

type ScreenResponse = { entries: { text: string }[] };

function say(input: { phone: string; text: string }): Promise<Response> {
  return SELF.fetch(`${ORIGIN}/dev/owner/${input.phone}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: MessageKind.Text, text: input.text }),
  });
}

async function screenTexts(input: { phone: string }): Promise<string[]> {
  const response = await SELF.fetch(`${ORIGIN}/dev/owner/${input.phone}/screen`);
  const screen = (await response.json()) as ScreenResponse;
  return screen.entries.map((entry) => entry.text);
}

function newPhone(): string {
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(PHONE_SUFFIX_DIGITS)), (value) => String(value % 10)).join('');
  return `${PHONE_PREFIX}${suffix}`;
}

async function accountTotal(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM accounts').first<{ total: number }>();
  if (row === null) throw new Error('count missing');
  return row.total;
}

describe('owner simulator on the production inbound path', () => {
  it('creates the account and the install lines for a new phone', async () => {
    const phone = newPhone();
    expect((await say({ phone, text: 'oi' })).status).toBe(STATUS_OK);
    expect((await say({ phone, text: 'novo agente claude' })).status).toBe(STATUS_OK);
    const texts = (await screenTexts({ phone })).join('\n');
    expect(texts).toContain(`${ORIGIN}/i/zb_inst_`);
    expect(texts).not.toContain('zb_conn_');
  });

  it('lists the created agent without any secret', async () => {
    const phone = newPhone();
    await say({ phone, text: 'oi' });
    await say({ phone, text: 'novo agente claude' });
    await say({ phone, text: 'agentes' });
    const texts = await screenTexts({ phone });
    expect(texts.at(-1)).toContain('claude');
    expect(texts.join('\n')).not.toContain('zb_conn_');
  });

  it('refuses a malformed phone and creates no account', async () => {
    await seedAccount({ agent: 'alpha' });
    const before = await accountTotal();
    expect((await say({ phone: MALFORMED_PHONE, text: 'oi' })).status).toBe(STATUS_BAD_REQUEST);
    expect(await accountTotal()).toBe(before);
  });

  it('deletes the account after the confirmation phrase', async () => {
    const phone = newPhone();
    await say({ phone, text: 'oi' });
    expect(await findAccounts({ waId: phone })).toHaveLength(1);
    await say({ phone, text: 'apagar conta' });
    await say({ phone, text: 'apagar conta definitivamente' });
    expect(await findAccounts({ waId: phone })).toEqual([]);
  });
});

import { AGENTS_PER_ACCOUNT_LIMIT } from '@zapbip/core';
import { MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { ScreenEntry } from '../../src/contract/account-inbox-rpc';
import { stack } from './stack';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const BRAZIL_PREFIX = '55119';
const UNITED_STATES_PREFIX = '1415';
const PHONE_SUFFIX_DIGITS = 8;
const INSTALL_LINK_PATTERN = /\/i\/zb_inst_[A-Za-z0-9_-]{22}/;
const NOT_FOUND = 404;

type Locale = {
  prefix: string;
  create: (name: string) => string;
  rotate: (name: string) => string;
  revoke: (name: string) => string;
  list: string;
  requestDeletion: string;
  confirmDeletion: string;
  created: RegExp;
  revoked: RegExp;
};

const PORTUGUESE: Locale = {
  prefix: BRAZIL_PREFIX,
  create: (name) => `novo agente ${name}`,
  rotate: (name) => `girar ${name}`,
  revoke: (name) => `revogar ${name}`,
  list: 'agentes',
  requestDeletion: 'apagar conta',
  confirmDeletion: 'apagar conta definitivamente',
  created: /Agente .* criado/,
  revoked: /revogado/i,
};

const ENGLISH: Locale = {
  prefix: UNITED_STATES_PREFIX,
  create: (name) => `new agent ${name}`,
  rotate: (name) => `rotate ${name}`,
  revoke: (name) => `revoke ${name}`,
  list: 'agents',
  requestDeletion: 'delete account',
  confirmDeletion: 'delete account permanently',
  created: /Agent .* created/,
  revoked: /revoked/i,
};

function newPhone(input: { prefix: string }): string {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(PHONE_SUFFIX_DIGITS)), (value) => String(value % 10)).join('');
  return `${input.prefix}${digits}`;
}

async function say(input: { phone: string; text: string }): Promise<void> {
  const response = await fetch(`${stack().origin}/dev/owner/${input.phone}/messages`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind: MessageKind.Text, text: input.text }),
  });
  expect(response.status).toBe(200);
}

async function screenOf(input: { phone: string }): Promise<string[]> {
  const response = await fetch(`${stack().origin}/dev/owner/${input.phone}/screen`);
  const body = (await response.json()) as { entries: ScreenEntry[] };
  return body.entries.map((entry) => entry.text);
}

function installLinkIn(input: { texts: string[] }): string {
  const link = input.texts.join('\n').match(INSTALL_LINK_PATTERN);
  if (link === null) throw new Error('the screen carries no install link');
  return link[0];
}

describe.each([
  { name: 'pt-BR', row: 424, locale: PORTUGUESE },
  { name: 'en-US', row: 425, locale: ENGLISH },
])('[row $row] accounts walk in $name', ({ locale }) => {
  test('create, rotate, revoke and delete over the simulator', async () => {
    const phone = newPhone({ prefix: locale.prefix });
    await say({ phone, text: 'hi' });
    await say({ phone, text: locale.create('agent-one') });
    const created = await screenOf({ phone });
    expect(created.join('\n')).toMatch(locale.created);
    expect(created.join('\n')).not.toContain('zb_conn_');
    const firstLink = installLinkIn({ texts: created });

    await say({ phone, text: locale.rotate('agent-one') });
    const rotatedLink = installLinkIn({ texts: (await screenOf({ phone })).slice(created.length) });
    expect(rotatedLink).not.toBe(firstLink);

    await say({ phone, text: locale.revoke('agent-one') });
    expect((await screenOf({ phone })).at(-1)).toMatch(locale.revoked);

    await say({ phone, text: locale.requestDeletion });
    await say({ phone, text: locale.confirmDeletion });
    const gone = await fetch(`${stack().origin}/dev/owner/${phone}/screen`);
    expect(gone.status).toBe(NOT_FOUND);
  });
});

describe('accounts limits and locale', () => {
  test('the ninth agent is refused, and a revoked slot is reusable', async () => {
    const phone = newPhone({ prefix: ENGLISH.prefix });
    await say({ phone, text: 'hi' });
    await Array.from({ length: AGENTS_PER_ACCOUNT_LIMIT }).reduce<Promise<void>>(
      (previous, _, index) => previous.then(() => say({ phone, text: ENGLISH.create(`agent${index}`) })),
      Promise.resolve(),
    );
    const before = (await screenOf({ phone })).length;
    await say({ phone, text: ENGLISH.create('overflow') });
    const refusal = (await screenOf({ phone })).slice(before).join('\n');
    expect(refusal).not.toMatch(INSTALL_LINK_PATTERN);
    await say({ phone, text: ENGLISH.revoke('agent0') });
    const afterRevoke = (await screenOf({ phone })).length;
    await say({ phone, text: ENGLISH.create('overflow') });
    expect((await screenOf({ phone })).slice(afterRevoke).join('\n')).toMatch(INSTALL_LINK_PATTERN);
  });

  test('a Brazilian number is answered in Portuguese and any other in English', async () => {
    const brazilian = newPhone({ prefix: PORTUGUESE.prefix });
    const american = newPhone({ prefix: ENGLISH.prefix });
    await say({ phone: brazilian, text: PORTUGUESE.list });
    await say({ phone: american, text: ENGLISH.list });
    expect((await screenOf({ phone: brazilian })).join('\n')).toMatch(/agente/i);
    expect((await screenOf({ phone: american })).join('\n')).toMatch(/agent/i);
  });
});

const UNKNOWN_SECRET = `zb_conn_${'A'.repeat(43)}`;
const UNAUTHORIZED = 401;

function secondSecretOf(input: { agent: string }): string {
  const secret = stack().secondSecrets[input.agent];
  if (secret === undefined) throw new Error(`no seeded secret for ${input.agent}`);
  return secret;
}

async function probeMcp(input: { secret: string }): Promise<{ status: number; body: string }> {
  const response = await fetch(`${stack().origin}/c/${input.secret}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  return { status: response.status, body: await response.text() };
}

describe('accounts walk against real connections', () => {
  test('[row 424][row 425] a secret is refused with the bytes of an unknown one after rotate, revoke and deletion', async () => {
    const phone = stack().secondPhone;
    const unknown = await probeMcp({ secret: UNKNOWN_SECRET });
    expect((await probeMcp({ secret: secondSecretOf({ agent: 'rotator' }) })).status).toBe(200);
    await say({ phone, text: PORTUGUESE.rotate('rotator') });
    expect(await probeMcp({ secret: secondSecretOf({ agent: 'rotator' }) })).toEqual(unknown);
    await say({ phone, text: PORTUGUESE.revoke('revoked') });
    expect(await probeMcp({ secret: secondSecretOf({ agent: 'revoked' }) })).toEqual(unknown);
    expect((await probeMcp({ secret: secondSecretOf({ agent: 'doomed' }) })).status).toBe(200);
    await say({ phone, text: PORTUGUESE.requestDeletion });
    await say({ phone, text: PORTUGUESE.confirmDeletion });
    expect(await probeMcp({ secret: secondSecretOf({ agent: 'doomed' }) })).toEqual(unknown);
    expect(unknown.status).toBe(UNAUTHORIZED);
    expect((await fetch(`${stack().origin}/dev/owner/${phone}/screen`)).status).toBe(NOT_FOUND);
  });

  test('[row 426] the language of a plain reply follows the account, whatever command words were typed', async () => {
    const phone = newPhone({ prefix: ENGLISH.prefix });
    await say({ phone, text: 'hi' });
    await say({ phone, text: PORTUGUESE.list });
    await say({ phone, text: 'ajuda' });
    const before = (await screenOf({ phone })).length;
    await say({ phone, text: 'bom dia' });
    const reply = (await screenOf({ phone })).slice(before).join('\n');
    expect(reply).not.toMatch(/Nenhum agente|mensagem/i);
  });
});

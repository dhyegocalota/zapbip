import { env, reset, SELF } from 'cloudflare:test';
import { AccountState, SECOND_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBHOOK_SIGNATURE_HEADER } from '../../src/adapters/whatsapp/whatsapp-constants';
import { WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import { LogEvent } from '../../src/contract/log';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import { notificationWith } from '../fixtures/whatsapp/inbound/notification';
import { signatureHeaderOf } from '../fixtures/whatsapp/inbound/signed-webhook';
import { applyDirectoryMigration } from '../support/seed';
import { findAccounts, screenTextsOf } from './owner-inbound-fixtures';

const WEBHOOK_URL = `http://example.com${WHATSAPP_WEBHOOK_PATH}`;
const UNKNOWN_PHONE = '5511900000099';
const FIRST_TEXT = 'AK-first-message-text';
const STATUS_OK = 200;

async function postFromUnknownPhone(): Promise<Response> {
  const message = {
    ...textFixture,
    from: UNKNOWN_PHONE,
    id: 'wamid.AK1',
    timestamp: String(Math.floor(Date.now() / SECOND_MS)),
    text: { body: FIRST_TEXT },
  };
  const body = JSON.stringify(notificationWith({ messages: [message] }));
  const signature = await signatureHeaderOf({ appSecret: env.META_APP_SECRET as string, body: new TextEncoder().encode(body) });
  return SELF.fetch(WEBHOOK_URL, { method: 'POST', headers: { [WEBHOOK_SIGNATURE_HEADER]: signature }, body });
}

beforeEach(applyDirectoryMigration);
afterEach(() => {
  vi.restoreAllMocks();
  return reset();
});

describe('webhook route from a phone without an account', () => {
  it('AK-1 opens an active account, stores no owner message and logs the creation without the phone', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' ')));
    const response = await postFromUnknownPhone();
    expect(response.status).toBe(STATUS_OK);
    const accounts = await findAccounts({ waId: UNKNOWN_PHONE });
    const [account] = accounts;
    if (account === undefined) throw new Error('account is missing');
    expect(accounts).toHaveLength(1);
    expect(account.state).toBe(AccountState.Active);
    const screen = await screenTextsOf({ accountId: account.accountId });
    expect(screen.join('\n')).not.toContain(FIRST_TEXT);
    const output = lines.join('\n');
    expect(lines.filter((line) => line.includes(LogEvent.AccountCreated))).toHaveLength(1);
    expect(output).not.toContain(UNKNOWN_PHONE);
    expect(output).not.toContain(FIRST_TEXT);
  });
});

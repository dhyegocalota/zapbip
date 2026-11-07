import { MessageKind, OwnerLocale } from '@zapbip/types';
import { createExecutionContext, reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../../src/contract/env';
import { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import developmentEntry from '../../src/index.dev';
import { applyDirectoryMigration } from '../support/seed';
import { accountInboxStub, testEnv } from '../support/workers-env';

const ORIGIN = 'http://example.com';
const BAD_FLAG = 'yes';
const STATUS_OK = 200;
const STATUS_SERVER_ERROR = 500;
const ACCOUNT_ID = 'acc_bad_flag';
const OWNER_PHONE = '5511900000005';

const badBindings: Bindings = { ...testEnv, WAITLIST_ENABLED: BAD_FLAG };

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('a bad WAITLIST_ENABLED binding', () => {
  beforeEach(applyDirectoryMigration);

  it('[row 259] AK-7 fails the owner simulator request naming the flag and keeps /health up', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const health = await developmentEntry.fetch(new Request(`${ORIGIN}/health`), badBindings, createExecutionContext());
    expect(health.status).toBe(STATUS_OK);
    const owner = await developmentEntry.fetch(
      new Request(`${ORIGIN}/dev/owner/${OWNER_PHONE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: MessageKind.Text, text: 'oi' }),
      }),
      badBindings,
      createExecutionContext(),
    );
    expect(owner.status).toBe(STATUS_SERVER_ERROR);
    expect(errors.mock.calls.flat().map(String).join(' ')).toContain('WAITLIST_ENABLED');
  });

  it('[row 260] AK-8 lets an account object built with the bad flag keep receiving owner messages', async () => {
    const outcome = await runInDurableObject(accountInboxStub({ accountId: ACCOUNT_ID }), async (_instance, state) => {
      const inbox = new DevAccountInbox(state, badBindings);
      await vi.waitFor(() => expect((inbox as unknown as { dependencies?: object }).dependencies).toBeDefined());
      return inbox.receiveOwnerMessage({
        ownerLocale: OwnerLocale.PortugueseBrazil,
        channelMessageId: 'wamid.bad-flag',
        ownerMessage: {
          at: Date.now(),
          replyToMessageId: null,
          forwarded: false,
          content: { kind: MessageKind.Text, text: 'oi' },
        },
      });
    });
    expect(outcome.ok).toBe(true);
  });
});

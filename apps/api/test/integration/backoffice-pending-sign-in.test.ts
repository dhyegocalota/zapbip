import { beforeEach, describe, expect, test } from 'vitest';
import { pruneBackoffice } from '../../src/backoffice/audit/prune';
import { consumePendingSignIn, createPendingSignIn, isPendingSignInLive } from '../../src/backoffice/auth/pending-sign-in';
import { BACKOFFICE_PENDING_SIGN_IN_MS } from '../../src/contract/constants';
import { testEnv } from '../support/workers-env';
import { resetBackoffice } from './backoffice-auth-fixtures';

const NOW = Date.UTC(2026, 10, 7, 12);
const database = testEnv.CONNECTIONS;

async function pendingRows(): Promise<number> {
  const row = await database.prepare('SELECT COUNT(*) AS total FROM backoffice_pending_sign_ins').first<{ total: number }>();
  return row!.total;
}

beforeEach(async () => {
  await resetBackoffice();
  await database.prepare('DELETE FROM backoffice_pending_sign_ins').run();
});

describe('pending sign-in', () => {
  test('is consumed once and refused the second time', async () => {
    const token = await createPendingSignIn({ database, now: NOW });
    expect(await consumePendingSignIn({ database, token, now: NOW })).toBe(true);
    expect(await consumePendingSignIn({ database, token, now: NOW })).toBe(false);
  });

  test('stores a digest of the token and never the token', async () => {
    const token = await createPendingSignIn({ database, now: NOW });
    const row = await database.prepare('SELECT token_digest FROM backoffice_pending_sign_ins').first<{ token_digest: string }>();
    expect(row!.token_digest).not.toBe(token);
  });

  test('is refused after it expires and the row is gone', async () => {
    const token = await createPendingSignIn({ database, now: NOW });
    expect(await consumePendingSignIn({ database, token, now: NOW + BACKOFFICE_PENDING_SIGN_IN_MS })).toBe(false);
    expect(await pendingRows()).toBe(0);
  });

  test('is accepted one millisecond before it expires', async () => {
    const token = await createPendingSignIn({ database, now: NOW });
    expect(await consumePendingSignIn({ database, token, now: NOW + BACKOFFICE_PENDING_SIGN_IN_MS - 1 })).toBe(true);
  });

  test('is read live before expiry and not after, without deleting the row', async () => {
    const token = await createPendingSignIn({ database, now: NOW });
    expect(await isPendingSignInLive({ database, token, now: NOW })).toBe(true);
    expect(await isPendingSignInLive({ database, token, now: NOW + BACKOFFICE_PENDING_SIGN_IN_MS })).toBe(false);
    expect(await pendingRows()).toBe(1);
  });

  test('refuses an unknown token', async () => {
    await createPendingSignIn({ database, now: NOW });
    expect(await consumePendingSignIn({ database, token: 'unknown-token', now: NOW })).toBe(false);
    expect(await isPendingSignInLive({ database, token: 'unknown-token', now: NOW })).toBe(false);
  });

  test('a second create replaces the first', async () => {
    const first = await createPendingSignIn({ database, now: NOW });
    const second = await createPendingSignIn({ database, now: NOW });
    expect(await pendingRows()).toBe(1);
    expect(await consumePendingSignIn({ database, token: first, now: NOW })).toBe(false);
    expect(await consumePendingSignIn({ database, token: second, now: NOW })).toBe(true);
  });

  test('the prune removes expired rows and keeps live ones', async () => {
    const expired = await createPendingSignIn({ database, now: NOW });
    const later = NOW + BACKOFFICE_PENDING_SIGN_IN_MS;
    await pruneBackoffice({ database, now: later });
    expect(await pendingRows()).toBe(0);
    const live = await createPendingSignIn({ database, now: later });
    await pruneBackoffice({ database, now: later + 1 });
    expect(await isPendingSignInLive({ database, token: live, now: later + 1 })).toBe(true);
    expect(await isPendingSignInLive({ database, token: expired, now: later + 1 })).toBe(false);
  });
});

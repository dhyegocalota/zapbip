import { AccountState, OwnerLocale } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sweepDeletingAccounts } from '../../src/accounts/deletion-sweep';
import type { Bindings } from '../../src/contract/env';
import { applyDirectoryMigration, seedAccount, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';

const SUSPENDED = 'acc_idle_suspended';

describe('sweepDeletingAccounts without a deleting account', () => {
  beforeEach(async () => {
    await applyDirectoryMigration();
    await seedAccount({ accountId: SUSPENDED, state: AccountState.Suspended });
    await seedOwnerIdentity({ accountId: SUSPENDED, phone: '5511900000004', ownerLocale: OwnerLocale.PortugueseBrazil });
  });
  afterEach(reset);

  it('[row 362] AK-5 calls no inbox, no media bucket', async () => {
    const inboxGet = vi.fn();
    const bucketList = vi.fn();
    const bucketDelete = vi.fn();
    const environment = {
      ...testEnv,
      ACCOUNT_INBOX: { idFromName: inboxGet, get: inboxGet },
      MEDIA: { list: bucketList, delete: bucketDelete },
    } as unknown as Bindings;
    await sweepDeletingAccounts({ environment });
    expect(inboxGet).not.toHaveBeenCalled();
    expect(bucketList).not.toHaveBeenCalled();
    expect(bucketDelete).not.toHaveBeenCalled();
  });
});

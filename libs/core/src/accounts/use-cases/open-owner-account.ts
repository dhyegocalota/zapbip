import { AccountState, IdPrefix } from '@zapbip/types';
import type { AccountLookup } from '../account-types';
import { NEW_ACCOUNTS_PER_DAY_LIMIT, NEW_ACCOUNTS_WINDOW_MS } from '../constants';
import { ownerLocaleOf } from '../owner-locale';
import type { OpenOwnerAccountInput } from './types';

export async function openOwnerAccount(input: OpenOwnerAccountInput): Promise<AccountLookup | null> {
  const { dependencies, waId, writtenText, homeNumberId, waitlistEnabled, createdAt } = input;
  const lookup = await dependencies.accounts.findOrCreateByWaId({
    waId,
    accountId: dependencies.ids.next({ prefix: IdPrefix.Account }),
    initialState: waitlistEnabled ? AccountState.Waitlisted : AccountState.Active,
    locale: ownerLocaleOf({ waId, writtenText }),
    homeNumberId,
    createdAt,
    newAccountsCap: { since: createdAt - NEW_ACCOUNTS_WINDOW_MS, limit: NEW_ACCOUNTS_PER_DAY_LIMIT },
  });
  return lookup;
}

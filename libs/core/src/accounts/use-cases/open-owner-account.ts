import { AccountState, IdPrefix, OwnerLocale } from '@zapbip/types';
import type { AccountLookup } from '../account-types';
import { BRAZIL_COUNTRY_CODE, NEW_ACCOUNTS_PER_DAY_LIMIT, NEW_ACCOUNTS_WINDOW_MS } from '../constants';
import type { OpenOwnerAccountInput } from './types';

export function ownerLocaleOf(input: { waId: string }): OwnerLocale {
  return input.waId.startsWith(BRAZIL_COUNTRY_CODE) ? OwnerLocale.PortugueseBrazil : OwnerLocale.EnglishUs;
}

export async function openOwnerAccount(input: OpenOwnerAccountInput): Promise<AccountLookup | null> {
  const { dependencies, waId, homeNumberId, waitlistEnabled, createdAt } = input;
  const lookup = await dependencies.accounts.findOrCreateByWaId({
    waId,
    accountId: dependencies.ids.next({ prefix: IdPrefix.Account }),
    initialState: waitlistEnabled ? AccountState.Waitlisted : AccountState.Active,
    locale: ownerLocaleOf({ waId }),
    homeNumberId,
    createdAt,
    newAccountsCap: { since: createdAt - NEW_ACCOUNTS_WINDOW_MS, limit: NEW_ACCOUNTS_PER_DAY_LIMIT },
  });
  return lookup;
}

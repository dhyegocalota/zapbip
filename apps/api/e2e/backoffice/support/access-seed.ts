import { AccountState, DAY_MS, OwnerLocale } from '@zapbip/types';
import { ALPHA_NUMBER, insertNumber } from './metrics-seed';
import { execute } from './operator-database';

export const WAITING_PHONES = ['5511911110001', '5511911110002', '5511911110003'];
export const WAITLIST_EMAILS = ['first@example.com', 'second@example.com'];

function insertWaitingAccount(input: { index: number; createdAt: number }): string[] {
  const accountId = `walk_waiting_${input.index}`;
  return [
    `INSERT INTO accounts (id, state, created_at, number_id) VALUES ('${accountId}', '${AccountState.Waitlisted}', ${input.createdAt}, '${ALPHA_NUMBER.id}')`,
    `INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES ('${WAITING_PHONES[input.index]}', '${accountId}', NULL, '${OwnerLocale.PortugueseBrazil}', ${input.createdAt})`,
  ];
}

function insertWaitlistEntry(input: { index: number; createdAt: number }): string {
  return `INSERT INTO landing_waitlist (email, locale, referral_code, referred_by, credited, created_at)
    VALUES ('${WAITLIST_EMAILS[input.index]}', '${OwnerLocale.EnglishUs}', 'walkcode${input.index}', NULL, 0, ${input.createdAt})`;
}

export function seedAccess(): void {
  const now = Date.now();
  execute({
    statements: [
      insertNumber({ number: ALPHA_NUMBER }),
      ...WAITING_PHONES.flatMap((_phone, index) =>
        insertWaitingAccount({ index, createdAt: now - (WAITING_PHONES.length - index) * DAY_MS }),
      ),
      ...WAITLIST_EMAILS.map((_email, index) => insertWaitlistEntry({ index, createdAt: now - (WAITLIST_EMAILS.length - index) * DAY_MS })),
    ],
  });
}

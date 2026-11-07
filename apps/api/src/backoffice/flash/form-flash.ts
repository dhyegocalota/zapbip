import type { HttpStatus, WhatsAppNumberState } from '@zapbip/types';
import type { Context } from 'hono';
import type { BackofficeCopyKey } from '../backoffice-copy';
import { FLASH_MAX_AGE_MS, SEE_OTHER_STATUS } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import type { FieldErrors, RegistrationValues } from '../numbers/registration-form';

export type FlashStatus = HttpStatus.Unauthorized | HttpStatus.UnprocessableEntity | HttpStatus.Conflict;

export type FormFlash = {
  status: FlashStatus;
  failure: BackofficeCopyKey | null;
  errors: FieldErrors;
  values: RegistrationValues | null;
  selectedState: WhatsAppNumberState | null;
};

type StoredFlash = FormFlash & { path: string; storedAt: number };

const SELECT_FLASH_STATEMENT = 'SELECT flash FROM backoffice_sessions WHERE token_digest = ?';
const STORE_FLASH_STATEMENT = 'UPDATE backoffice_sessions SET flash = ? WHERE token_digest = ?';
const CLAIM_FLASH_STATEMENT = 'UPDATE backoffice_sessions SET flash = NULL WHERE token_digest = ? AND flash = ?';

function sessionDigestOf(input: { context: Context<BackofficeEnv> }): string {
  const session = input.context.get('session');
  if (session === null) throw new Error('a flash was used without a session');
  return session.digest;
}

export async function redirectWithFlash(input: { context: Context<BackofficeEnv>; path: string; flash: FormFlash }): Promise<Response> {
  const { context, path, flash } = input;
  const stored: StoredFlash = { ...flash, path, storedAt: Date.now() };
  await context.env.CONNECTIONS.prepare(STORE_FLASH_STATEMENT).bind(JSON.stringify(stored), sessionDigestOf({ context })).run();
  return context.redirect(path, SEE_OTHER_STATUS);
}

export async function takeFlash(input: { context: Context<BackofficeEnv>; path: string }): Promise<FormFlash | null> {
  const { context, path } = input;
  const digest = sessionDigestOf({ context });
  const row = await context.env.CONNECTIONS.prepare(SELECT_FLASH_STATEMENT).bind(digest).first<{ flash: string | null }>();
  if (row === null || row.flash === null) return null;
  const stored = JSON.parse(row.flash) as StoredFlash;
  if (stored.path !== path) return null;
  const claim = await context.env.CONNECTIONS.prepare(CLAIM_FLASH_STATEMENT).bind(digest, row.flash).run();
  const isClaimed = claim.meta.changes > 0;
  const isFresh = Date.now() - stored.storedAt <= FLASH_MAX_AGE_MS;
  return isClaimed && isFresh ? stored : null;
}

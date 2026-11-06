import type { OwnerLocale } from '@zapbip/types';
import type { AccountReply, MenuRow } from './account-types';

export function renderAccountReply(input: { reply: AccountReply }): string {
  void input;
  throw new Error('renderAccountReply is not implemented');
}

export function buildMenuRows(input: { locale: OwnerLocale }): MenuRow[] {
  void input;
  throw new Error('buildMenuRows is not implemented');
}

export function buildMenuButtonText(input: { locale: OwnerLocale }): string {
  void input;
  throw new Error('buildMenuButtonText is not implemented');
}

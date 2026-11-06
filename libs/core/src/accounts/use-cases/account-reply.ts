import { ReplyKind, type AccountReplyIntent, type AccountReplyParameter, type OwnerLocale } from '@zapbip/types';
import type { AccountCommandResult, AccountCompensation, AccountReply } from '../account-types';
import { buildMenuRows } from '../account-copy';

type ParameterValues = Partial<Record<AccountReplyParameter, string>>;

export function buildTextReply(input: { intent: AccountReplyIntent; locale: OwnerLocale; parameters?: ParameterValues }): AccountReply {
  const { intent, locale, parameters = {} } = input;
  return { intent, kind: ReplyKind.Text, locale, parameters, menuRows: [] };
}

export function buildMenuReply(input: { intent: AccountReplyIntent; locale: OwnerLocale }): AccountReply {
  const { intent, locale } = input;
  return { intent, kind: ReplyKind.List, locale, parameters: {}, menuRows: buildMenuRows({ locale }) };
}

export function buildResult(input: {
  replies: AccountReply[];
  compensation?: AccountCompensation | null;
  deletionConfirmed?: boolean;
}): AccountCommandResult {
  const { replies, compensation = null, deletionConfirmed = false } = input;
  return { replies, compensation, deletionConfirmed };
}

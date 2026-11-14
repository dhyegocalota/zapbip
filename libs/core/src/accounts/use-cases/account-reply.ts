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
  connectionId?: string | null;
}): AccountCommandResult {
  const { replies, compensation = null, deletionConfirmed = false, connectionId = null } = input;
  return { replies, compensation, deletionConfirmed, connectionId: compensation === null ? connectionId : compensation.connectionId };
}

export function firstReplyOf(input: { result: AccountCommandResult }): AccountReply {
  const [reply] = input.result.replies;
  if (reply === undefined) throw new Error('the command produced no reply');
  return reply;
}

export function parameterOf(input: { reply: AccountReply; name: AccountReplyParameter }): string | null {
  const value = input.reply.parameters[input.name];
  if (value === undefined) return null;
  return value;
}

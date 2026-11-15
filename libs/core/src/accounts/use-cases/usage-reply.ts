import { AccountReplyIntent, AccountReplyParameter, OwnerLocale, type CommandKind } from '@zapbip/types';
import { NAME_PLACEHOLDER } from '../account-copy';
import type { AccountReply } from '../account-types';
import { COMMAND_WORDS } from '../command-words';
import { buildTextReply } from './account-reply';

export function findCommandWords(input: { kind: CommandKind; locale: OwnerLocale }): string {
  const entry = COMMAND_WORDS.find((word) => word.kind === input.kind && word.locale === input.locale);
  if (entry === undefined) throw new Error(`no command words for ${input.kind} in ${input.locale}`);
  return entry.words;
}

export function buildUsageReply(input: { kind: CommandKind; locale: OwnerLocale }): AccountReply {
  const { kind, locale } = input;
  const usage = `${findCommandWords({ kind, locale })} ${NAME_PLACEHOLDER[locale]}`;
  return buildTextReply({ intent: AccountReplyIntent.Usage, locale, parameters: { [AccountReplyParameter.Usage]: usage } });
}

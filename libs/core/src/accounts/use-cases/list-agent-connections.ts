import { AccountReplyIntent, AccountReplyParameter, type OwnerLocale } from '@zapbip/types';
import type { AccountCommandResult, ConnectionRecord } from '../account-types';
import { UNKNOWN_CLIENT_LABEL } from '../account-copy';
import { buildResult, buildTextReply } from './account-reply';
import type { ListAgentConnectionsInput } from './types';

const LINE_BREAK = '\n';
const WHATSAPP_FORMATTING_PATTERN = /[*_~`]/g;
const ISO_DATE_LENGTH = 10;

function describeConnection(input: { connection: ConnectionRecord; locale: OwnerLocale }): string {
  const createdOn = new Date(input.connection.createdAt).toISOString().slice(0, ISO_DATE_LENGTH);
  const { agent, clientName } = input.connection;
  return `${agent} (${createdOn}, ${clientName === null ? UNKNOWN_CLIENT_LABEL[input.locale] : clientName.replace(WHATSAPP_FORMATTING_PATTERN, '')})`;
}

export async function listAgentConnections(input: ListAgentConnectionsInput): Promise<AccountCommandResult> {
  const { dependencies, account } = input;
  const { locale, accountId } = account;
  const active = await dependencies.connections.listActive({ accountId });
  if (active.length === 0) return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.EmptyList, locale })] });
  const agents = active.map((connection) => describeConnection({ connection, locale })).join(LINE_BREAK);
  const parameters = { [AccountReplyParameter.Agents]: agents };
  return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.Listed, locale, parameters })] });
}

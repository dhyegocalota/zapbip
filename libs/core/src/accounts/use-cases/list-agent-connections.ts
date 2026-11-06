import { AccountReplyIntent, AccountReplyParameter } from '@zapbip/types';
import type { AccountCommandResult, ConnectionRecord } from '../account-types';
import { buildResult, buildTextReply } from './account-reply';
import type { ListAgentConnectionsInput } from './types';

const LINE_BREAK = '\n';
const ISO_DATE_LENGTH = 10;

function describeConnection(input: { connection: ConnectionRecord }): string {
  const createdOn = new Date(input.connection.createdAt).toISOString().slice(0, ISO_DATE_LENGTH);
  return `${input.connection.agent} (${createdOn})`;
}

export async function listAgentConnections(input: ListAgentConnectionsInput): Promise<AccountCommandResult> {
  const { dependencies, account } = input;
  const { locale, accountId } = account;
  const active = await dependencies.connections.listActive({ accountId });
  if (active.length === 0) return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.EmptyList, locale })] });
  const agents = active.map((connection) => describeConnection({ connection })).join(LINE_BREAK);
  const parameters = { [AccountReplyParameter.Agents]: agents };
  return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.Listed, locale, parameters })] });
}

import { AccountReplyParameter, type AccountReplyIntent } from '@zapbip/types';
import type { AgentName } from '../../inbox/connection';
import type { AccountReply } from '../account-types';
import { buildTextReply } from './account-reply';
import type { OwnerAccountInput } from './types';

const CONNECTION_LINK_PATH_PREFIX = '/c/';
const CONNECTION_LINK_PATH_SUFFIX = '/mcp';

export async function buildInstallPromptReply(
  input: OwnerAccountInput & { intent: AccountReplyIntent; agent: AgentName; secret: string },
): Promise<AccountReply> {
  const { dependencies, account, publicOrigin, intent, agent, secret } = input;
  const connectionLink = `${publicOrigin}${CONNECTION_LINK_PATH_PREFIX}${secret}${CONNECTION_LINK_PATH_SUFFIX}`;
  const installPrompt = await dependencies.installPromptRenderer.render({
    accountId: account.accountId,
    agent,
    connectionLink,
    locale: account.locale,
  });
  return buildTextReply({
    intent,
    locale: account.locale,
    parameters: { [AccountReplyParameter.AgentName]: agent, [AccountReplyParameter.InstallPrompt]: installPrompt },
  });
}

import { AccountReplyParameter, INSTALL_PAGE_PATH_PREFIX, type AccountReplyIntent } from '@zapbip/types';
import type { AgentName } from '../../inbox/connection';
import { renderInstallLines } from '../account-copy';
import type { AccountReply } from '../account-types';
import { buildTextReply } from './account-reply';
import type { OwnerAccountInput } from './types';

export function buildInstallPromptReply(
  input: OwnerAccountInput & { intent: AccountReplyIntent; agent: AgentName; installCode: string },
): AccountReply {
  const { account, publicOrigin, intent, agent, installCode } = input;
  const installLink = `${publicOrigin}${INSTALL_PAGE_PATH_PREFIX}${installCode}`;
  const installPrompt = renderInstallLines({ installLink, locale: account.locale });
  return buildTextReply({
    intent,
    locale: account.locale,
    parameters: { [AccountReplyParameter.AgentName]: agent, [AccountReplyParameter.InstallPrompt]: installPrompt },
  });
}

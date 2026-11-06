import { AccountState, IdPrefix, MessageKind, OwnerLocale, type AccountReplyIntent } from '@zapbip/types';
import type { AgentName } from '../../inbox/connection';
import type { OwnerInboundContent } from '../../inbox/use-cases/types';
import type { AccountCommandResult, OwnerAccountContext } from '../account-types';
import { receiveAccountMessage } from '../use-cases/receive-account-message';
import type { OwnerAccountInput, ReceiveAccountMessageResult } from '../use-cases/types';
import { createInMemoryAccountDependencies, type InMemoryAccountEnvironment } from './in-memory-accounts';

export const PUBLIC_ORIGIN = 'https://zapbip.test';
export const BRAZIL_WA_ID = '5511999990000';
export const UNITED_STATES_WA_ID = '14155550100';

let channelMessageCounter = 0;

export type AccountFixture = { environment: InMemoryAccountEnvironment; account: OwnerAccountContext };

export async function createAccountFixture(
  input: { state?: AccountState; locale?: OwnerLocale; waId?: string } = {},
): Promise<AccountFixture> {
  const environment = createInMemoryAccountDependencies();
  const account = await environment.openAccount(input);
  await environment.repository.saveWindow({ window: { lastOwnerMessageAt: environment.clock.now(), noticeSentForClosedWindow: false } });
  return { environment, account };
}

export function ownerInputOf(input: AccountFixture): OwnerAccountInput {
  return { dependencies: input.environment.dependencies, account: input.account, publicOrigin: PUBLIC_ORIGIN };
}

export function receiveAccount(
  input: AccountFixture & { content: OwnerInboundContent; replyToMessageId?: string | null; channelMessageId?: string },
): Promise<ReceiveAccountMessageResult> {
  channelMessageCounter += 1;
  const { environment, account, content, replyToMessageId = null, channelMessageId = `wamid.account.${channelMessageCounter}` } = input;
  return receiveAccountMessage({
    dependencies: environment.dependencies,
    account,
    channelMessageId,
    ownerMessage: { at: environment.clock.now(), replyToMessageId, content },
    publicOrigin: PUBLIC_ORIGIN,
  });
}

export function receiveAccountText(input: AccountFixture & { text: string; replyToMessageId?: string | null }) {
  return receiveAccount({ ...input, content: { kind: MessageKind.Text, text: input.text } });
}

export function receiveListTap(input: AccountFixture & { optionId: string }) {
  return receiveAccount({
    ...input,
    content: { kind: MessageKind.Choice, optionId: input.optionId, optionTitle: input.optionId, optionDescription: null },
  });
}

export function intentsOf(input: { result: AccountCommandResult }): AccountReplyIntent[] {
  return input.result.replies.map((reply) => reply.intent);
}

export async function addAgent(input: AccountFixture & { agent: AgentName }): Promise<string> {
  const { environment, account, agent } = input;
  const issued = await environment.secrets.issue();
  await environment.registry.register({
    connection: {
      connectionId: environment.dependencies.ids.next({ prefix: IdPrefix.Connection }),
      accountId: account.accountId,
      agent,
      secretDigest: issued.digest,
      createdAt: environment.clock.now(),
    },
    activeLimit: Number.MAX_SAFE_INTEGER,
  });
  return issued.digest;
}

export function sessionTexts(input: AccountFixture): string[] {
  return input.environment.sender.sessions.flatMap((message) => (message.kind === MessageKind.Text ? [message.text] : []));
}

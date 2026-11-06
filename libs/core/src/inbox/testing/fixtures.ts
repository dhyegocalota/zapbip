import { DAY_MS, MessageKind, OwnerLocale, ReplyStatus, SECOND_MS } from '@zapbip/types';
import type { ConnectionIdentity } from '../connection';
import { WINDOW_MS } from '../constants';
import type { Question } from '../question';
import { ask } from '../use-cases/ask';
import { touchAgent } from '../use-cases/touch-agent';
import { receiveOwnerMessage } from '../use-cases/receive-owner-message';
import type { OwnerInboundContent, ReceiveResult } from '../use-cases/types';
import { createInMemoryDependencies, type InMemoryEnvironment } from './in-memory';

export const ACCOUNT_ID = 'account_1';
export const START_AT = 10 * DAY_MS;

let wamidCounter = 0;

function nextWamid(): string {
  wamidCounter += 1;
  return `wamid.${wamidCounter}`;
}

export async function createEnvironment(): Promise<InMemoryEnvironment> {
  const environment = createInMemoryDependencies({ accountId: ACCOUNT_ID, startAt: START_AT });
  await openWindow({ environment });
  return environment;
}

export function openWindow(input: { environment: InMemoryEnvironment }): Promise<void> {
  const { repository, clock } = input.environment;
  return repository.saveWindow({ window: { lastOwnerMessageAt: clock.now(), noticeSentForClosedWindow: false } });
}

export function closeWindow(input: { environment: InMemoryEnvironment }): Promise<void> {
  const { repository, clock } = input.environment;
  return repository.saveWindow({ window: { lastOwnerMessageAt: clock.now() - WINDOW_MS, noticeSentForClosedWindow: false } });
}

export function connectionOf(input: { agent: string; ownerLocale?: OwnerLocale }): ConnectionIdentity {
  const { agent, ownerLocale = OwnerLocale.EnglishUs } = input;
  return { accountId: ACCOUNT_ID, agent, ownerLocale };
}

export async function registerAgents(input: { environment: InMemoryEnvironment; agents: string[] }): Promise<void> {
  await Promise.all(input.agents.map((agent) => touchAgent({ dependencies: input.environment.dependencies, agent })));
}

export async function askAndAbandon(input: {
  environment: InMemoryEnvironment;
  agent?: string;
  text?: string;
  options?: string[];
}): Promise<Question> {
  const { environment, agent = 'alpha', text = 'Deploy?', options = ['Sim', 'Não'] } = input;
  const asking = ask({
    dependencies: environment.dependencies,
    connection: connectionOf({ agent }),
    text,
    options,
    optionDescriptions: [],
    timeoutMs: SECOND_MS,
  });
  await environment.clock.advance({ ms: SECOND_MS });
  const result = await asking;
  if (result.status !== ReplyStatus.Pending) throw new Error('expected a pending question');
  const question = await environment.repository.findQuestion({ questionId: result.questionId });
  if (question === null) throw new Error('expected the question to be stored');
  return question;
}

export function receive(input: {
  environment: InMemoryEnvironment;
  content: OwnerInboundContent;
  replyToMessageId?: string | null;
  channelMessageId?: string;
  ownerLocale?: OwnerLocale;
}): Promise<ReceiveResult> {
  const { environment, content, replyToMessageId = null, channelMessageId = nextWamid(), ownerLocale = OwnerLocale.EnglishUs } = input;
  return receiveOwnerMessage({
    dependencies: environment.dependencies,
    ownerLocale,
    channelMessageId,
    ownerMessage: { at: environment.clock.now(), replyToMessageId, content },
  });
}

export function receiveText(input: {
  environment: InMemoryEnvironment;
  text: string;
  replyToMessageId?: string | null;
}): Promise<ReceiveResult> {
  return receive({
    environment: input.environment,
    content: { kind: MessageKind.Text, text: input.text },
    replyToMessageId: input.replyToMessageId,
  });
}

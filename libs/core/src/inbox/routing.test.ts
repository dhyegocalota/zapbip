import { DeliveryState, MessageDirection, MessageKind, RoutingRule, ForwardedKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { Message } from './message';
import type { Question } from './question';
import { routeOwnerMessage, type RoutingInput } from './routing';

const AT = 1_000;

function agentMessage(input: { messageId: string; agent: string | null }): Message {
  return {
    messageId: input.messageId,
    direction: MessageDirection.ToOwner,
    agent: input.agent,
    at: AT,
    replyToMessageId: null,
    delivery: DeliveryState.Sent,
    readByAgent: true,
    forwarded: ForwardedKind.None,
    kind: MessageKind.Text,
    text: 'hello',
  };
}

function openQuestion(input: { questionId: string; agent: string }): Question {
  return {
    questionId: input.questionId,
    agent: input.agent,
    text: 'Deploy?',
    options: [{ optionIndex: 0, title: 'Sim', description: null }],
    normalizedKey: input.questionId,
    promptMessageId: `msg_${input.questionId}`,
    askedAt: AT,
    answer: null,
  };
}

function routingInput(overrides: Partial<RoutingInput>): RoutingInput {
  return {
    text: 'oi',
    referencedMessage: null,
    referencedQuestion: null,
    openQuestions: [],
    agents: [],
    lastAgentWrite: null,
    routingListOpen: false,
    ...overrides,
  };
}

function agentRecords(...names: string[]) {
  return names.map((agent) => ({ agent, lastSeenAt: AT }));
}

describe('routeOwnerMessage', () => {
  test('CU-68 rule 2 quoted reply to an agent message', () => {
    const decision = routeOwnerMessage(
      routingInput({ text: 'ok', referencedMessage: agentMessage({ messageId: 'msg_1', agent: 'alpha' }), agents: agentRecords('alpha') }),
    );
    expect(decision).toMatchObject({ rule: RoutingRule.QuotedOrReaction, agent: 'alpha', answersQuestionId: null });
  });

  test('CU-69 rule 2 reaction to an open prompt', () => {
    const question = openQuestion({ questionId: 'qst_1', agent: 'alpha' });
    const decision = routeOwnerMessage(
      routingInput({
        text: null,
        referencedMessage: agentMessage({ messageId: 'msg_qst_1', agent: 'alpha' }),
        referencedQuestion: question,
        openQuestions: [question],
        agents: agentRecords('alpha'),
      }),
    );
    expect(decision).toMatchObject({ rule: RoutingRule.QuotedOrReaction, agent: 'alpha', answersQuestionId: 'qst_1' });
  });

  test('CU-70 rule 2 skips a quoted held message', () => {
    const decision = routeOwnerMessage(
      routingInput({ referencedMessage: agentMessage({ messageId: 'msg_1', agent: null }), agents: agentRecords('beta') }),
    );
    expect(decision.rule).not.toBe(RoutingRule.QuotedOrReaction);
    expect(decision).toMatchObject({ rule: RoutingRule.AskOwner, agent: null, sendsRoutingList: true });
  });

  test('CU-71 rule 3 mention', () => {
    const decision = routeOwnerMessage(routingInput({ text: '@beta faça X', agents: agentRecords('alpha', 'beta') }));
    expect(decision).toMatchObject({ rule: RoutingRule.AgentMention, agent: 'beta', textForAgent: 'faça X' });
  });

  test('CU-72 rule 3 skips an unknown mention', () => {
    const decision = routeOwnerMessage(routingInput({ text: '@ghost oi', agents: agentRecords('alpha') }));
    expect(decision.rule).toBe(RoutingRule.AskOwner);
  });

  test('CU-73 rule 3 needs the trailing space', () => {
    const decision = routeOwnerMessage(routingInput({ text: '@beta', agents: agentRecords('beta') }));
    expect(decision.rule).toBe(RoutingRule.AskOwner);
  });

  test('CU-74 rule 4 one agent with one open question', () => {
    const decision = routeOwnerMessage(
      routingInput({
        text: 'sim',
        openQuestions: [openQuestion({ questionId: 'qst_1', agent: 'alpha' })],
        agents: agentRecords('alpha', 'beta'),
      }),
    );
    expect(decision).toMatchObject({ rule: RoutingRule.OpenQuestion, agent: 'alpha', answersQuestionId: 'qst_1' });
  });

  test('CU-75 rule 4 newest question wins across agents', () => {
    const decision = routeOwnerMessage(
      routingInput({
        openQuestions: [openQuestion({ questionId: 'qst_2', agent: 'beta' }), openQuestion({ questionId: 'qst_1', agent: 'alpha' })],
        agents: agentRecords('alpha', 'beta'),
      }),
    );
    expect(decision).toMatchObject({ agent: 'beta', answersQuestionId: 'qst_2' });
  });

  test('CU-76 rule 4 newest of one agent wins', () => {
    const decision = routeOwnerMessage(
      routingInput({
        openQuestions: [openQuestion({ questionId: 'qst_3', agent: 'alpha' }), openQuestion({ questionId: 'qst_1', agent: 'alpha' })],
        agents: agentRecords('alpha'),
      }),
    );
    expect(decision).toMatchObject({ agent: 'alpha', answersQuestionId: 'qst_3' });
  });

  test('CU-77 mention beats an open question', () => {
    const decision = routeOwnerMessage(
      routingInput({
        text: '@beta oi',
        openQuestions: [openQuestion({ questionId: 'qst_1', agent: 'alpha' })],
        agents: agentRecords('alpha', 'beta'),
      }),
    );
    expect(decision).toMatchObject({ rule: RoutingRule.AgentMention, agent: 'beta', answersQuestionId: null });
  });

  test('CU-78 mention answers the mentioned agent newest open question', () => {
    const decision = routeOwnerMessage(
      routingInput({
        text: '@alpha sim',
        openQuestions: [openQuestion({ questionId: 'qst_1', agent: 'alpha' })],
        agents: agentRecords('alpha'),
      }),
    );
    expect(decision).toMatchObject({ agent: 'alpha', answersQuestionId: 'qst_1', textForAgent: 'sim' });
  });

  test('rule 5 is suspended while a routing list is open', () => {
    const decision = routeOwnerMessage(
      routingInput({ lastAgentWrite: 'gamma', agents: agentRecords('gamma', 'delta'), routingListOpen: true }),
    );
    expect(decision).toMatchObject({ rule: RoutingRule.AskOwner, agent: null, sendsRoutingList: false });
  });

  test('CU-79 rule 5 recent agent', () => {
    const decision = routeOwnerMessage(routingInput({ lastAgentWrite: 'gamma' }));
    expect(decision).toMatchObject({ rule: RoutingRule.RecentAgent, agent: 'gamma' });
  });

  test('CU-80 rule 6 with agents and no open list', () => {
    const decision = routeOwnerMessage(routingInput({ agents: agentRecords('alpha', 'beta') }));
    expect(decision).toMatchObject({ rule: RoutingRule.AskOwner, agent: null, sendsRoutingList: true });
  });

  test('CU-81 rule 6 with a list already open', () => {
    const decision = routeOwnerMessage(routingInput({ agents: agentRecords('alpha', 'beta'), routingListOpen: true }));
    expect(decision).toMatchObject({ rule: RoutingRule.AskOwner, agent: null, sendsRoutingList: false });
  });

  test('CU-82 rule 6 with zero agents', () => {
    const decision = routeOwnerMessage(routingInput({}));
    expect(decision).toMatchObject({ rule: RoutingRule.AskOwner, agent: null, sendsRoutingList: false });
  });

  test('CU-83 media does not answer', () => {
    const decision = routeOwnerMessage(
      routingInput({ text: null, openQuestions: [openQuestion({ questionId: 'qst_1', agent: 'alpha' })], agents: agentRecords('alpha') }),
    );
    expect(decision).toMatchObject({ rule: RoutingRule.OpenQuestion, agent: 'alpha', answersQuestionId: null });
  });

  test('the text reaches the agent unchanged outside a mention', () => {
    const decision = routeOwnerMessage(routingInput({ text: 'oi', lastAgentWrite: 'alpha' }));
    expect(decision.textForAgent).toBe('oi');
  });
});

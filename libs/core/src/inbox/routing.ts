import { RoutingRule } from '@zapbip/types';
import { AGENT_MENTION_PATTERN } from './constants';
import type { AgentName } from './connection';
import type { AgentRecord } from './inbox-records';
import type { Message } from './message';
import type { Question } from './question';

export type RoutingInput = {
  text: string | null;
  referencedMessage: Message | null;
  referencedQuestion: Question | null;
  openQuestions: Question[];
  agents: AgentRecord[];
  lastAgentWrite: AgentName | null;
  routingListOpen: boolean;
};

export type RoutingDecision = {
  rule: RoutingRule;
  agent: AgentName | null;
  answersQuestionId: string | null;
  textForAgent: string | null;
  sendsRoutingList: boolean;
};

type RuleResolver = (input: RoutingInput) => RoutingDecision | null;

function decide(input: {
  rule: RoutingRule;
  agent: AgentName | null;
  answersQuestionId: string | null;
  textForAgent: string | null;
}): RoutingDecision {
  return { ...input, sendsRoutingList: false };
}

function newestOpenQuestionOf(input: { openQuestions: Question[]; agent: AgentName }): Question | undefined {
  return input.openQuestions.find((question) => question.agent === input.agent);
}

function resolveQuotedOrReaction(input: RoutingInput): RoutingDecision | null {
  const agent = input.referencedMessage === null ? null : input.referencedMessage.agent;
  if (agent === null) return null;
  const question = input.referencedQuestion;
  const answersQuestionId = question !== null && question.answer === null ? question.questionId : null;
  return decide({ rule: RoutingRule.QuotedOrReaction, agent, answersQuestionId, textForAgent: input.text });
}

function resolveAgentMention(input: RoutingInput): RoutingDecision | null {
  const match = input.text === null ? null : AGENT_MENTION_PATTERN.exec(input.text);
  if (match === null || input.text === null) return null;
  const agent = match[1]!;
  if (!input.agents.some((record) => record.agent === agent)) return null;
  const question = newestOpenQuestionOf({ openQuestions: input.openQuestions, agent });
  const answersQuestionId = question === undefined ? null : question.questionId;
  return decide({ rule: RoutingRule.AgentMention, agent, answersQuestionId, textForAgent: input.text.slice(match[0].length).trim() });
}

function resolveOpenQuestion(input: RoutingInput): RoutingDecision | null {
  const [newest] = input.openQuestions;
  if (newest === undefined) return null;
  const answersQuestionId = input.text === null ? null : newest.questionId;
  return decide({ rule: RoutingRule.OpenQuestion, agent: newest.agent, answersQuestionId, textForAgent: input.text });
}

function resolveRecentAgent(input: RoutingInput): RoutingDecision | null {
  if (input.lastAgentWrite === null) return null;
  return decide({ rule: RoutingRule.RecentAgent, agent: input.lastAgentWrite, answersQuestionId: null, textForAgent: input.text });
}

function resolveAskOwner(input: RoutingInput): RoutingDecision {
  const sendsRoutingList = !input.routingListOpen && input.agents.length > 0;
  return { rule: RoutingRule.AskOwner, agent: null, answersQuestionId: null, textForAgent: input.text, sendsRoutingList };
}

const RULE_RESOLVERS: RuleResolver[] = [resolveQuotedOrReaction, resolveAgentMention, resolveOpenQuestion, resolveRecentAgent];

export function routeOwnerMessage(input: RoutingInput): RoutingDecision {
  const decision = RULE_RESOLVERS.map((resolver) => resolver(input)).find((candidate): candidate is RoutingDecision => candidate !== null);
  return decision === undefined ? resolveAskOwner(input) : decision;
}

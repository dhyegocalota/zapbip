import type { RoutingRule } from '@zapbip/types';
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

export function routeOwnerMessage(input: RoutingInput): RoutingDecision {
  void input;
  throw new Error('routeOwnerMessage is not implemented');
}

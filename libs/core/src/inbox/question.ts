import type { AgentName } from './connection';
import type { QuestionOption } from './message';

export type QuestionAnswer = {
  optionIndex: number | null;
  text: string;
  answerMessageId: string;
  answeredAt: number;
};

export type Question = {
  questionId: string;
  agent: AgentName;
  text: string;
  options: QuestionOption[];
  normalizedKey: string;
  promptMessageId: string;
  askedAt: number;
  answer: QuestionAnswer | null;
};

export type ParsedOptionId = {
  questionId: string;
  optionIndex: number;
};

export type ParsedRouteOptionId = {
  messageId: string;
  agent: AgentName;
};

import { ROUTE_OPTION_PREFIX } from './constants';
import type { AgentName } from './connection';
import type { QuestionOption } from './message';
import type { ParsedOptionId, ParsedRouteOptionId } from './question';

const OPTION_ID_SEPARATOR = ':';
const OPTION_INDEX_PATTERN = /^\d+$/;
const ROUTE_OPTION_ID_PATTERN = new RegExp(`^${ROUTE_OPTION_PREFIX}:([^:]+):([^:]+)$`);
const ROUTE_QUESTION_ID_PREFIX = `${ROUTE_OPTION_PREFIX}${OPTION_ID_SEPARATOR}`;

export function formatOptionId(input: { questionId: string; optionIndex: number }): string {
  return `${input.questionId}${OPTION_ID_SEPARATOR}${input.optionIndex}`;
}

export function parseOptionId(input: { optionId: string }): ParsedOptionId | null {
  const separatorAt = input.optionId.lastIndexOf(OPTION_ID_SEPARATOR);
  const questionId = input.optionId.slice(0, separatorAt);
  const optionIndex = input.optionId.slice(separatorAt + 1);
  const isOptionId = separatorAt > 0 && OPTION_INDEX_PATTERN.test(optionIndex) && !ROUTE_OPTION_ID_PATTERN.test(input.optionId);
  if (!isOptionId) return null;
  return { questionId, optionIndex: Number(optionIndex) };
}

export function formatRouteOptionId(input: { messageId: string; agent: AgentName }): string {
  return `${ROUTE_OPTION_PREFIX}${OPTION_ID_SEPARATOR}${input.messageId}${OPTION_ID_SEPARATOR}${input.agent}`;
}

export function parseRouteOptionId(input: { optionId: string }): ParsedRouteOptionId | null {
  const match = ROUTE_OPTION_ID_PATTERN.exec(input.optionId);
  if (match === null) return null;
  const [, messageId, agent] = match;
  return { messageId: messageId!, agent: agent! };
}

export function formatRoutingListQuestionId(input: { messageId: string }): string {
  return `${ROUTE_QUESTION_ID_PREFIX}${input.messageId}`;
}

export function formatChoiceOptionIds(input: { questionId: string; options: QuestionOption[] }): string[] {
  const isRoutingList = input.questionId.startsWith(ROUTE_QUESTION_ID_PREFIX);
  const messageId = input.questionId.slice(ROUTE_QUESTION_ID_PREFIX.length);
  return input.options.map((option) =>
    option.rowId === undefined
      ? isRoutingList
        ? formatRouteOptionId({ messageId, agent: option.title })
        : formatOptionId({ questionId: input.questionId, optionIndex: option.optionIndex })
      : option.rowId,
  );
}

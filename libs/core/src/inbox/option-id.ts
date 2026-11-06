import type { AgentName } from './connection';
import type { QuestionOption } from './message';
import type { ParsedOptionId, ParsedRouteOptionId } from './question';

export function formatOptionId(input: { questionId: string; optionIndex: number }): string {
  void input;
  throw new Error('formatOptionId is not implemented');
}

export function parseOptionId(input: { optionId: string }): ParsedOptionId | null {
  void input;
  throw new Error('parseOptionId is not implemented');
}

export function formatRouteOptionId(input: { messageId: string; agent: AgentName }): string {
  void input;
  throw new Error('formatRouteOptionId is not implemented');
}

export function parseRouteOptionId(input: { optionId: string }): ParsedRouteOptionId | null {
  void input;
  throw new Error('parseRouteOptionId is not implemented');
}

export function formatChoiceOptionIds(input: { questionId: string; options: QuestionOption[] }): string[] {
  void input;
  throw new Error('formatChoiceOptionIds is not implemented');
}

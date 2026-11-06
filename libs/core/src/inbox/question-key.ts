import type { AgentName } from './connection';

export function buildQuestionKey(input: { agent: AgentName; text: string; optionTitles: string[] }): string {
  void input;
  throw new Error('buildQuestionKey is not implemented');
}

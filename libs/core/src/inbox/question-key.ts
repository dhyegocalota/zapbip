import type { AgentName } from './connection';
import { normalizeText } from './validation';

function normalizeForKey(input: { value: string }): string {
  return normalizeText(input).toLowerCase();
}

export function buildQuestionKey(input: { agent: AgentName; text: string; optionTitles: string[] }): string {
  return JSON.stringify([
    input.agent,
    normalizeForKey({ value: input.text }),
    input.optionTitles.map((value) => normalizeForKey({ value })),
  ]);
}

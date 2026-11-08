import type { DocsLanguage } from '@zapbip/types';
import type { AgentPlugin } from '../contract';

export type PageRuleInput = { label: string; language: DocsLanguage; page: string; hasInstall: boolean; plugin: AgentPlugin | null };

export function pageRuleViolationsOf(input: PageRuleInput): string[] {
  throw new Error(`pageRuleViolationsOf is not implemented for ${input.label}`);
}

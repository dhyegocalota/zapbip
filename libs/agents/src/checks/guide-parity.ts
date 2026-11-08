import type { DocsLanguage } from '@zapbip/types';
import type { AgentInstall } from '../contract';

export type GuideParityEntry = {
  id: string;
  install: AgentInstall;
  isPluginPage: boolean;
  guides: Record<DocsLanguage, string>;
};

export function guideParityViolationsOf(_input: { entries: GuideParityEntry[] }): string[] {
  throw new Error('guideParityViolationsOf is not implemented');
}

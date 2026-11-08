import { DocsLanguage, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from './contract';
import { LEGACY_MATRIX_ORDER, LEGACY_NAVIGATION_ORDER } from './legacy-order';

export enum OrderSurface {
  InstallPage = 'installPage',
  Matrix = 'matrix',
  Navigation = 'navigation',
}

const WAKE_LADDER: WakeRung[] = [WakeRung.Local, WakeRung.Webhook, WakeRung.Scheduled, WakeRung.Standby, WakeRung.Inbox];
const LEGACY_INSTALL_PAGE_ORDER_IDS: string[] = [
  'claude-code',
  'codex',
  'cursor',
  'gemini-cli',
  'grok-bot',
  'claude-ai',
  'chatgpt',
  'grok-web',
  'hermes',
  'openclaw',
  'any-mcp-client',
];
const LEGACY_ORDER: Record<OrderSurface, string[]> = {
  [OrderSurface.InstallPage]: LEGACY_INSTALL_PAGE_ORDER_IDS,
  [OrderSurface.Matrix]: LEGACY_MATRIX_ORDER,
  [OrderSurface.Navigation]: LEGACY_NAVIGATION_ORDER,
};

function compareByRungThenName(input: { definitions: Record<string, AgentDefinition> }) {
  return (leftId: string, rightId: string): number => {
    const left = input.definitions[leftId] as AgentDefinition;
    const right = input.definitions[rightId] as AgentDefinition;
    const rungDifference = WAKE_LADDER.indexOf(left.listen.rung) - WAKE_LADDER.indexOf(right.listen.rung);
    if (rungDifference !== 0) return rungDifference;
    return left.docs.matrixName[DocsLanguage.English]
      .toLowerCase()
      .localeCompare(right.docs.matrixName[DocsLanguage.English].toLowerCase());
  };
}

export function agentOrderOf(input: { definitions: Record<string, AgentDefinition>; surface: OrderSurface }): string[] {
  const ids = Object.keys(input.definitions);
  const knownIds = LEGACY_ORDER[input.surface].filter((id) => ids.includes(id));
  const newIds = ids.filter((id) => !knownIds.includes(id)).sort(compareByRungThenName({ definitions: input.definitions }));
  return [...knownIds, ...newIds];
}

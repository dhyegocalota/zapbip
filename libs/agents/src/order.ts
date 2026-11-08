import { DocsLanguage, WakeRung } from '@zapbip/types';
import { compareCodePoints } from './code-points';
import type { AgentDefinition } from './contract';

const WAKE_LADDER: WakeRung[] = [WakeRung.Local, WakeRung.Webhook, WakeRung.Scheduled, WakeRung.Standby, WakeRung.Inbox];

function compareByRungThenName(input: { definitions: Record<string, AgentDefinition> }) {
  return (leftId: string, rightId: string): number => {
    const left = input.definitions[leftId] as AgentDefinition;
    const right = input.definitions[rightId] as AgentDefinition;
    const rungDifference = WAKE_LADDER.indexOf(left.listen.rung) - WAKE_LADDER.indexOf(right.listen.rung);
    if (rungDifference !== 0) return rungDifference;
    return compareCodePoints({
      left: left.docs.matrixName[DocsLanguage.English].toLowerCase(),
      right: right.docs.matrixName[DocsLanguage.English].toLowerCase(),
    });
  };
}

export function agentOrderOf(input: { definitions: Record<string, AgentDefinition> }): string[] {
  return Object.keys(input.definitions).sort(compareByRungThenName({ definitions: input.definitions }));
}

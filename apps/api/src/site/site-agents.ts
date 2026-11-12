import { AGENT_INSTALLS, InstallClient } from '@zapbip/agents/install';

const LEADING_AGENT_COUNT = 2;
const LIST_SEPARATOR = ', ';
const FIRST_SENDER_INDEX = 0;
const SECOND_SENDER_INDEX = 1;
const THIRD_SENDER_INDEX = 2;

export const SENDER_INDEXES = { first: FIRST_SENDER_INDEX, second: SECOND_SENDER_INDEX, third: THIRD_SENDER_INDEX };

export function siteAgentNames(): string[] {
  return Object.values(AGENT_INSTALLS).map((install) => install.productName);
}

export function leadingAgentNames(): string {
  return siteAgentNames().slice(0, LEADING_AGENT_COUNT).join(LIST_SEPARATOR);
}

export function senderNameOf(input: { index: number }): string {
  return siteAgentNames()[input.index]!;
}

export function siteAgents(): { id: InstallClient; name: string }[] {
  throw new Error('siteAgents is not implemented');
}

export function siteAgentIdOf(input: { value: string | undefined }): InstallClient | null {
  throw new Error('siteAgentIdOf is not implemented');
}

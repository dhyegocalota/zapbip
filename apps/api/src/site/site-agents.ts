import { AGENT_INSTALLS, InstallClient } from '@zapbip/agents/install';

const LEADING_AGENT_COUNT = 2;
const LIST_SEPARATOR = ', ';
const FIRST_SENDER_INDEX = 0;
const SECOND_SENDER_INDEX = 1;
const THIRD_SENDER_INDEX = 2;

export const SENDER_INDEXES = { first: FIRST_SENDER_INDEX, second: SECOND_SENDER_INDEX, third: THIRD_SENDER_INDEX };

export function siteAgents(): { id: InstallClient; name: string }[] {
  return Object.values(InstallClient).map((id) => ({ id, name: AGENT_INSTALLS[id].productName }));
}

export function siteAgentNameOf(input: { id: InstallClient }): string {
  return AGENT_INSTALLS[input.id].productName;
}

export function siteAgentNames(): string[] {
  return siteAgents().map((agent) => agent.name);
}

export function siteAgentIdOf(input: { value: string | undefined }): InstallClient | null {
  return Object.values(InstallClient).find((id) => id === input.value) ?? null;
}

export function leadingAgentNames(): string {
  return siteAgentNames().slice(0, LEADING_AGENT_COUNT).join(LIST_SEPARATOR);
}

export function senderNameOf(input: { index: number }): string {
  return siteAgentNames()[input.index]!;
}

export function initialsOf(input: { name: string }): string {
  throw new Error('initialsOf is not implemented');
}

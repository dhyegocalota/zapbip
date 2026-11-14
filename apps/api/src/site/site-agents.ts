import { AGENT_INSTALLS, InstallClient } from '@zapbip/agents/install';
import { OwnerLocale } from '@zapbip/types';

export enum SiteStartTab {
  AnyMcp = 'any',
}

const LEADING_AGENT_COUNT = 2;
const INITIALS_LENGTH = 2;
const WHITESPACE_PATTERN = /\s+/;
const LIST_SEPARATORS: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: ', ',
  [OwnerLocale.PortugueseBrazil]: ', ',
  [OwnerLocale.Spanish]: ', ',
  [OwnerLocale.German]: ', ',
  [OwnerLocale.French]: ', ',
  [OwnerLocale.Korean]: ', ',
  [OwnerLocale.Japanese]: '、',
  [OwnerLocale.ChineseSimplified]: '、',
  [OwnerLocale.Arabic]: '، ',
};
const FIRST_SENDER_INDEX = 0;
const SECOND_SENDER_INDEX = 1;
const THIRD_SENDER_INDEX = 2;

export const SENDER_INDEXES = { first: FIRST_SENDER_INDEX, second: SECOND_SENDER_INDEX, third: THIRD_SENDER_INDEX };

export function siteAgents(): { id: InstallClient; name: string; logo: string | null }[] {
  return Object.values(InstallClient).map((id) => ({
    id,
    name: AGENT_INSTALLS[id].productName,
    logo: AGENT_INSTALLS[id].officialLogo,
  }));
}

export function agentParameterOf(input: { value: string | undefined }): InstallClient | SiteStartTab | null {
  if (input.value === SiteStartTab.AnyMcp) return SiteStartTab.AnyMcp;
  return siteAgentIdOf({ value: input.value });
}

export function siteQuickStartOf(input: { id: InstallClient; locale: OwnerLocale; connectionLink: string }): {
  hint: string;
  path: string[];
  code: string;
} {
  const { hint, path, code } = AGENT_INSTALLS[input.id].quickStart({
    locale: input.locale,
    connectionLink: input.connectionLink,
  });
  return { hint, path, code };
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

export function allAgentNames(input: { locale: OwnerLocale }): string {
  return siteAgentNames().join(LIST_SEPARATORS[input.locale]);
}

export function leadingAgentNames(input: { locale: OwnerLocale }): string {
  return siteAgentNames().slice(0, LEADING_AGENT_COUNT).join(LIST_SEPARATORS[input.locale]);
}

export function senderNameOf(input: { index: number }): string {
  return siteAgentNames()[input.index]!;
}

export function initialsOf(input: { name: string }): string {
  const words = input.name.split(WHITESPACE_PATTERN).filter((word) => word.length > 0);
  const letters =
    words.length > 1
      ? words
          .map((word) => word[0])
          .slice(0, INITIALS_LENGTH)
          .join('')
      : input.name.slice(0, INITIALS_LENGTH);
  return letters.toUpperCase();
}

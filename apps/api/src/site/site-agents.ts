import { AGENT_DEFINITIONS } from '@zapbip/agents/definitions';
import { DocsLanguage, OwnerLocale, WakeRung } from '@zapbip/types';
import { SiteCopyKey } from './site-copy';

export type SiteAgent = { name: string; chipKey: SiteCopyKey; seconds: string | null };

const DOCS_LANGUAGES: Record<OwnerLocale, DocsLanguage> = {
  [OwnerLocale.PortugueseBrazil]: DocsLanguage.PortugueseBrazil,
  [OwnerLocale.EnglishUs]: DocsLanguage.English,
};
const RUNG_CHIP_KEYS: Record<WakeRung, SiteCopyKey> = {
  [WakeRung.Local]: SiteCopyKey.ClientsLocal,
  [WakeRung.Webhook]: SiteCopyKey.ClientsCloud,
  [WakeRung.Scheduled]: SiteCopyKey.ClientsHourly,
  [WakeRung.Standby]: SiteCopyKey.ClientsStandby,
  [WakeRung.Inbox]: SiteCopyKey.ClientsAnyMcp,
};
const LEADING_AGENT_COUNT = 2;
const LIST_SEPARATOR = ', ';
const FIRST_SENDER_INDEX = 0;
const SECOND_SENDER_INDEX = 1;
const THIRD_SENDER_INDEX = 2;

export const SENDER_INDEXES = { first: FIRST_SENDER_INDEX, second: SECOND_SENDER_INDEX, third: THIRD_SENDER_INDEX };

export function siteAgentsOf(input: { locale: OwnerLocale }): SiteAgent[] {
  return Object.values(AGENT_DEFINITIONS).map(({ docs, listen }) => {
    const isTimedWake = listen.expectedDelaySeconds !== null && listen.rung !== WakeRung.Scheduled;
    return {
      name: docs.matrixName[DOCS_LANGUAGES[input.locale]],
      chipKey: isTimedWake ? SiteCopyKey.ClientsWakeSeconds : RUNG_CHIP_KEYS[listen.rung],
      seconds: isTimedWake ? String(listen.expectedDelaySeconds) : null,
    };
  });
}

export function leadingAgentNamesOf(input: { locale: OwnerLocale }): string {
  return siteAgentsOf(input)
    .slice(0, LEADING_AGENT_COUNT)
    .map((agent) => agent.name)
    .join(LIST_SEPARATOR);
}

export function senderNameOf(input: { locale: OwnerLocale; index: number }): string {
  return siteAgentsOf({ locale: input.locale })[input.index]!.name;
}

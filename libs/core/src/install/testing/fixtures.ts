import { InstallClient, OwnerLocale } from '@zapbip/types';
import type { InstallSectionInput } from '../prompts/install-section';

export const CONNECTION_LINK = 'https://x.example/c/zb_conn_FAKE/mcp';
export const LOCALES: OwnerLocale[] = Object.values(OwnerLocale);
export const CLIENTS: InstallClient[] = Object.values(InstallClient);

export function sectionInput(input: { locale: OwnerLocale; standbyAgent?: string | null }): InstallSectionInput {
  return {
    connectionLink: CONNECTION_LINK,
    locale: input.locale,
    standbyAgent: input.standbyAgent === undefined ? null : input.standbyAgent,
  };
}

export function lastNonEmptyLine(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .at(-1) as string;
}

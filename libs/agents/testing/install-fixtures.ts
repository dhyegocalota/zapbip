import type { InstallSectionInput } from '@zapbip/core';
import { OwnerLocale } from '@zapbip/types';
import { expect, test } from 'vitest';
import type { AgentInstall } from '../src/contract';

export const CONNECTION_LINK = 'https://x.example/c/zb_conn_FAKE/mcp';
export const LOCALES: OwnerLocale[] = Object.values(OwnerLocale);

export function sectionInput(input: { locale: OwnerLocale; standbyAgent?: string | null }): InstallSectionInput {
  return {
    connectionLink: CONNECTION_LINK,
    locale: input.locale,
    standbyAgent: input.standbyAgent === undefined ? null : input.standbyAgent,
  };
}

export function installSnapshotTests(input: { install: AgentInstall }): void {
  test.each(LOCALES)('renders the section it rendered before in %s', async (locale) => {
    await expect(input.install.render(sectionInput({ locale }))).toMatchFileSnapshot(`./install.${locale}.md`);
  });
}

export function installWakeNoteTests(input: { install: AgentInstall; wakeNote: Record<OwnerLocale, string> }): void {
  test.each(LOCALES)('C4 says how it is woken before the self-test in %s', (locale) => {
    const text = input.install.render(sectionInput({ locale }));
    expect(text).toContain(input.wakeNote[locale]);
    expect(text.indexOf(input.wakeNote[locale])).toBeLessThan(text.lastIndexOf('send_message'));
  });
}

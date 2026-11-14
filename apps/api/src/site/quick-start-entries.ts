import type { InstallClient } from '@zapbip/agents/install';
import type { OwnerLocale } from '@zapbip/types';
import { siteAgents, SiteStartTab, siteQuickStartOf } from './site-agents';
import { SITE_EXAMPLE_CONNECTION_LINK } from './site-constants';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';

const ANY_PATH_KEYS = [SiteCopyKey.StartAnyStepOpen, SiteCopyKey.StartAnyStepAdd, SiteCopyKey.StartAnyStepPaste];

export type QuickStartEntry = {
  id: InstallClient | SiteStartTab;
  agent: InstallClient | null;
  name: string;
  logoId: string | null;
  hint: string;
  path: string[];
  code: string;
};

export function quickStartEntriesOf(input: { locale: OwnerLocale }): QuickStartEntry[] {
  const { locale } = input;
  const translate = copyOf({ locale });
  const agentEntries = siteAgents().map((agent) => ({
    id: agent.id,
    agent: agent.id,
    name: agent.name,
    logoId: agent.logo,
    ...siteQuickStartOf({ id: agent.id, locale, connectionLink: SITE_EXAMPLE_CONNECTION_LINK }),
  }));
  const anyEntry: QuickStartEntry = {
    id: SiteStartTab.AnyMcp,
    agent: null,
    name: translate(SiteCopyKey.ClientsAnyMcpName),
    logoId: null,
    hint: translate(SiteCopyKey.StartAnyHint),
    path: ANY_PATH_KEYS.map((key) => translate(key)),
    code: SITE_EXAMPLE_CONNECTION_LINK,
  };
  return [...agentEntries, anyEntry];
}

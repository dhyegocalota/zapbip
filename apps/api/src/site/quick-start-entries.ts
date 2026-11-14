import type { InstallClient } from '@zapbip/agents/install';
import type { OwnerLocale } from '@zapbip/types';
import { setupPromptOf } from './setup-prompt';
import { siteAgents, SiteStartTab, siteQuickStartOf } from './site-agents';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';

const ANY_PATH_KEYS = [SiteCopyKey.StartAnyStepOpen, SiteCopyKey.StartAnyStepAdd, SiteCopyKey.StartAnyStepPaste];

export type QuickStartEntry = {
  id: InstallClient | SiteStartTab;
  agent: InstallClient | null;
  name: string;
  logoId: string | null;
  prompt: string;
  promptHint: string;
  hint: string;
  path: string[];
  code: string;
};

export function quickStartEntriesOf(input: { locale: OwnerLocale; origin: string; connectionLink: string }): QuickStartEntry[] {
  const { locale, origin, connectionLink } = input;
  const translate = copyOf({ locale });
  const prompt = setupPromptOf({ locale, origin });
  const agentEntries = siteAgents().map((agent) => ({
    id: agent.id,
    agent: agent.id,
    name: agent.name,
    logoId: agent.logo,
    prompt,
    promptHint: translate(SiteCopyKey.StartPromptHint, { agent: agent.name }),
    ...siteQuickStartOf({ id: agent.id, locale, connectionLink }),
  }));
  const anyEntry: QuickStartEntry = {
    id: SiteStartTab.AnyMcp,
    agent: null,
    name: translate(SiteCopyKey.ClientsAnyMcpName),
    logoId: null,
    prompt,
    promptHint: translate(SiteCopyKey.StartPromptHintAny),
    hint: translate(SiteCopyKey.StartAnyHint),
    path: ANY_PATH_KEYS.map((key) => translate(key)),
    code: connectionLink,
  };
  return [...agentEntries, anyEntry];
}

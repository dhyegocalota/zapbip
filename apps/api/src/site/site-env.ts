import type { InstallClient } from '@zapbip/agents/install';
import type { WebLocale } from '@zapbip/types';
import type { ShellTheme } from '../web-shell/shell-theme';
import type { Bindings } from '../contract/env';
import type { SiteStartTab } from './site-agents';

export type SiteEnv = {
  Bindings: Bindings;
  Variables: {
    locale: WebLocale;
    theme: ShellTheme;
    referralCode: string | null;
    agent: InstallClient | null;
    agentParameter: InstallClient | SiteStartTab | null;
    startTab: InstallClient | SiteStartTab;
  };
};

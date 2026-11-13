import type { InstallClient } from '@zapbip/agents/install';
import type { OwnerLocale } from '@zapbip/types';
import type { BackofficeTheme } from '../backoffice/backoffice-theme';
import type { Bindings } from '../contract/env';
import type { SiteStartTab } from './site-agents';

export type SiteEnv = {
  Bindings: Bindings;
  Variables: {
    locale: OwnerLocale;
    theme: BackofficeTheme;
    referralCode: string | null;
    agent: InstallClient | null;
    startTab: InstallClient | SiteStartTab;
  };
};

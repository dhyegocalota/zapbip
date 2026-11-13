import type { AccountState, OwnerLocale } from '@zapbip/types';
import type { ShellTheme } from '../web-shell/shell-theme';
import type { Bindings } from '../contract/env';

export type ClientAppSession = {
  sessionToken: string;
  accountId: string;
  waId: string;
  state: AccountState;
  locale: OwnerLocale;
  csrfToken: string;
};

export type ClientAppEnv = {
  Bindings: Bindings;
  Variables: {
    locale: OwnerLocale;
    theme: ShellTheme;
    session: ClientAppSession | null;
  };
};

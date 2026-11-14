import type { AccountState, WebLocale } from '@zapbip/types';
import type { ShellTheme } from '../web-shell/shell-theme';
import type { Bindings } from '../contract/env';

export type ClientAppSession = {
  sessionToken: string;
  accountId: string;
  waId: string;
  state: AccountState;
  locale: WebLocale;
  csrfToken: string;
};

export type ClientAppEnv = {
  Bindings: Bindings;
  Variables: {
    locale: WebLocale;
    theme: ShellTheme;
    session: ClientAppSession | null;
  };
};

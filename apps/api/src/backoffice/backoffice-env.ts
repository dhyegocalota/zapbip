import type { WebLocale } from '@zapbip/types';
import type { ShellTheme } from '../web-shell/shell-theme';
import type { Bindings } from '../contract/env';
import type { PagePolicy } from './backoffice-constants';

export type BackofficeSession = { token: string; digest: string };

export type BackofficeEnv = {
  Bindings: Bindings;
  Variables: {
    session: BackofficeSession | null;
    locale: WebLocale;
    theme: ShellTheme;
    clientAddress: string | null;
    pagePolicy: PagePolicy;
  };
};

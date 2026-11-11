import type { OwnerLocale } from '@zapbip/types';
import type { Bindings } from '../contract/env';
import type { PagePolicy } from './backoffice-constants';

export type BackofficeSession = { token: string; digest: string };

export type BackofficeEnv = {
  Bindings: Bindings;
  Variables: {
    session: BackofficeSession | null;
    locale: OwnerLocale;
    clientAddress: string | null;
    pagePolicy: PagePolicy;
  };
};

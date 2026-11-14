import { WAKE_AUTHORIZATION_PREFIX, WAKE_CONTENT_TYPE } from '../constants';
import type { PinnedWakeProviderRule } from '../wake-provider';

export const ALPHA_PROVIDER = 'alpha_routine';
export const BETA_PROVIDER = 'beta_routine';
export const ALPHA_HOST = 'alpha-routines.example';
export const BETA_HOST = 'beta-routines.example';
export const ALPHA_URL = `https://${ALPHA_HOST}/hooks/abcdefgh12`;
export const BETA_URL = `https://${BETA_HOST}/v1/fire/trig_01abc`;
const BETA_VERSION_HEADER = 'x-beta-version';

export const FIXTURE_PINNED_PROVIDERS: PinnedWakeProviderRule[] = [
  {
    providerId: ALPHA_PROVIDER,
    host: ALPHA_HOST,
    pathPattern: /^\/hooks\/[A-Za-z0-9_-]{8,64}$/,
    buildHeaders: ({ token }) => ({ authorization: `${WAKE_AUTHORIZATION_PREFIX}${token}`, 'content-type': WAKE_CONTENT_TYPE }),
  },
  {
    providerId: BETA_PROVIDER,
    host: BETA_HOST,
    pathPattern: /^\/v1\/fire\/trig_[A-Za-z0-9]+$/,
    buildHeaders: ({ token }) => ({
      authorization: `${WAKE_AUTHORIZATION_PREFIX}${token}`,
      'content-type': WAKE_CONTENT_TYPE,
      [BETA_VERSION_HEADER]: '1',
    }),
  },
];

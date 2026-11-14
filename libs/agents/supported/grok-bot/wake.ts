import { WAKE_AUTHORIZATION_PREFIX, WAKE_CONTENT_TYPE } from '@zapbip/core';
import type { AgentWakeTarget } from '../../src/contract';

export const wakeTarget: AgentWakeTarget = {
  providerId: 'grok_routine',
  host: 'api2.cursor.sh',
  exampleUrl: 'https://api2.cursor.sh/automations/webhook/abcdefgh12',
  pathPattern: /^\/automations\/webhook\/[A-Za-z0-9_-]{8,64}$/,
  buildHeaders: ({ token }) => ({
    authorization: `${WAKE_AUTHORIZATION_PREFIX}${token}`,
    'content-type': WAKE_CONTENT_TYPE,
  }),
};

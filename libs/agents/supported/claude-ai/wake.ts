import { WAKE_AUTHORIZATION_PREFIX, WAKE_CONTENT_TYPE } from '@zapbip/core';
import type { AgentWakeTarget } from '../../src/contract';

const BETA_HEADER = 'anthropic-beta';
const BETA_VALUE = 'experimental-cc-routine-2026-04-01';
const VERSION_HEADER = 'anthropic-version';
const VERSION_VALUE = '2023-06-01';

export const wakeTarget: AgentWakeTarget = {
  providerId: 'claude_routine',
  host: 'api.anthropic.com',
  exampleUrl: 'https://api.anthropic.com/v1/claude_code/routines/trig_01abc/fire',
  pathPattern: /^\/v1\/claude_code\/routines\/trig_[A-Za-z0-9]+\/fire$/,
  buildHeaders: ({ token }) => ({
    authorization: `${WAKE_AUTHORIZATION_PREFIX}${token}`,
    'content-type': WAKE_CONTENT_TYPE,
    [BETA_HEADER]: BETA_VALUE,
    [VERSION_HEADER]: VERSION_VALUE,
  }),
};

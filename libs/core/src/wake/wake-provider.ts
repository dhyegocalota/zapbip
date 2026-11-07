import { WakeProvider } from '@zapbip/types';
import {
  CLAUDE_ROUTINE_BETA_HEADER,
  CLAUDE_ROUTINE_BETA_VALUE,
  CLAUDE_ROUTINE_VERSION_HEADER,
  CLAUDE_ROUTINE_VERSION_VALUE,
  WAKE_AUTHORIZATION_PREFIX,
  WAKE_CONTENT_TYPE,
} from './constants';

export type PinnedWakeProvider = WakeProvider.GrokRoutine | WakeProvider.ClaudeRoutine;

export type PinnedWakeProviderRule = {
  host: string;
  pathPattern: RegExp;
  buildHeaders: (input: { token: string }) => Record<string, string>;
};

export const PINNED_WAKE_PROVIDER_RULES: Record<PinnedWakeProvider, PinnedWakeProviderRule> = {
  [WakeProvider.GrokRoutine]: {
    host: 'api2.cursor.sh',
    pathPattern: /^\/automations\/webhook\/[A-Za-z0-9_-]{8,64}$/,
    buildHeaders: ({ token }) => ({
      authorization: `${WAKE_AUTHORIZATION_PREFIX}${token}`,
      'content-type': WAKE_CONTENT_TYPE,
    }),
  },
  [WakeProvider.ClaudeRoutine]: {
    host: 'api.anthropic.com',
    pathPattern: /^\/v1\/claude_code\/routines\/trig_[A-Za-z0-9]+\/fire$/,
    buildHeaders: ({ token }) => ({
      authorization: `${WAKE_AUTHORIZATION_PREFIX}${token}`,
      'content-type': WAKE_CONTENT_TYPE,
      [CLAUDE_ROUTINE_BETA_HEADER]: CLAUDE_ROUTINE_BETA_VALUE,
      [CLAUDE_ROUTINE_VERSION_HEADER]: CLAUDE_ROUTINE_VERSION_VALUE,
    }),
  },
};

import type { InstallClient } from '@zapbip/agents/install';
import type { OwnerLocale } from '@zapbip/types';
import type { BackofficeTheme } from '../backoffice/backoffice-theme';
import type { SiteStartTab } from './site-agents';

export enum JoinState {
  Idle = 'idle',
  InvalidEmail = 'invalid_email',
  CaptchaFailed = 'captcha_failed',
  RateLimited = 'rate_limited',
  Unavailable = 'unavailable',
  Paused = 'paused',
  Joined = 'joined',
}

export type JoinFormState = Exclude<JoinState, JoinState.Paused | JoinState.Joined>;

export type JoinView =
  | { state: JoinFormState; emailValue: string }
  | { state: JoinState.Paused }
  | { state: JoinState.Joined; referralCode: string; creditedCount: number; cap: number };

export type PageModel = {
  locale: OwnerLocale;
  theme: BackofficeTheme;
  siteOrigin: string;
  turnstileSiteKey: string;
  referralCode: string | null;
  agent: InstallClient | null;
  agentParameter: InstallClient | SiteStartTab | null;
  startTab: InstallClient | SiteStartTab;
  join: JoinView;
};

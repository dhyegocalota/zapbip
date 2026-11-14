import { DAY_MS, MINUTE_MS } from '@zapbip/types';
import { ASK_MAX_WAIT_MS } from '../inbox/constants';
import type { InstallCodeColumns } from './account-types';

export const AGENTS_PER_ACCOUNT_LIMIT = 8;
export const OWNER_MESSAGES_PER_MINUTE = 20;
export const OUTBOUND_MESSAGES_PER_MINUTE = 30;
export const ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE = 120;
export const ACCOUNT_CHANGES_PER_MINUTE = 3;
export const RATE_LIMIT_PERIOD_MS = MINUTE_MS;
export const AGENT_CHANGE_APPROVAL_TIMEOUT_MS = ASK_MAX_WAIT_MS;
export const APPROVAL_REFERENCE_LENGTH = 6;
export const APPROVAL_COOLDOWN_MS = 10 * MINUTE_MS;
export const NEW_ACCOUNTS_PER_DAY_LIMIT = 50;
export const NEW_ACCOUNTS_WINDOW_MS = DAY_MS;
export const ONBOARDING_REPLY_COOLDOWN_MS = DAY_MS;
export const ONBOARDING_COOLDOWN_KEY = 'onboarding_reply';
export const DELETION_CONFIRM_TTL_MS = 10 * MINUTE_MS;
export const CONNECTION_LINK_PATH_PREFIX = '/c/';
export const CONNECTION_LINK_PATH_SUFFIX = '/mcp';
export const NO_INSTALL_CODE: InstallCodeColumns = {
  installCodeDigest: null,
  installCodeSealedSecret: null,
  installCodeExpiresAt: null,
};
export const COMMAND_LIST_ID_PREFIX = 'zapbip:';
export const LIST_BUTTON_TEXT_MAX_CHARS = 20;
export const BRAZIL_COUNTRY_CODE = '55';
export const ACCOUNT_MENU_QUESTION_ID = `${COMMAND_LIST_ID_PREFIX}menu`;
export const INVITE_CODE_PREFIX = 'zbi_';
export const INVITE_CODE_RANDOM_LENGTH = 24;
export const INVITE_CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
export const INVITE_CODE_BODY_PATTERN = `[a-z2-7]{${INVITE_CODE_RANDOM_LENGTH}}`;
export const INVITE_CODE_PATTERN = new RegExp(`\\b${INVITE_CODE_PREFIX}${INVITE_CODE_BODY_PATTERN}\\b`, 'i');
export const INVITE_CODE_MASK = `${INVITE_CODE_PREFIX}${'*'.repeat(INVITE_CODE_RANDOM_LENGTH)}`;

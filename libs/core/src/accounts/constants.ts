import { DAY_MS, MINUTE_MS } from '@zapbip/types';
import type { InstallCodeColumns } from './account-types';

export const AGENTS_PER_ACCOUNT_LIMIT = 8;
export const OWNER_MESSAGES_PER_MINUTE = 20;
export const OUTBOUND_MESSAGES_PER_MINUTE = 30;
export const ACCOUNT_OUTBOUND_MESSAGES_PER_MINUTE = 120;
export const RATE_LIMIT_PERIOD_MS = MINUTE_MS;
export const NEW_ACCOUNTS_PER_DAY_LIMIT = 50;
export const NEW_ACCOUNTS_WINDOW_MS = DAY_MS;
export const DELETION_CONFIRM_TTL_MS = 10 * MINUTE_MS;
export const CONNECTION_LINK_PATH_PREFIX = '/c/';
export const CONNECTION_LINK_PATH_SUFFIX = '/mcp';
export const EMPTY_CLIENT_MARK = '-';
export const NO_INSTALL_CODE: InstallCodeColumns = {
  installCodeDigest: null,
  installCodeSealedSecret: null,
  installCodeExpiresAt: null,
};
export const COMMAND_LIST_ID_PREFIX = 'zapbip:';
export const LIST_BUTTON_TEXT_MAX_CHARS = 20;
export const BRAZIL_COUNTRY_CODE = '55';
export const ACCOUNT_MENU_QUESTION_ID = `${COMMAND_LIST_ID_PREFIX}menu`;

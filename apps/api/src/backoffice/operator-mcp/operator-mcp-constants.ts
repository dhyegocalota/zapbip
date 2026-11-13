import { DAY_MS, MINUTE_MS } from '@zapbip/types';

export const OPERATOR_KEY_PREFIX = 'zbo_';
export const OPERATOR_KEY_ID_BYTES = 8;
export const OPERATOR_KEY_SECRET_BYTES = 32;
export const OPERATOR_KEY_ID_PATTERN = '[0-9a-f]{16}';
export const OPERATOR_KEY_SECRET_PATTERN = '[A-Za-z0-9_-]{43}';
export const OPERATOR_KEY_PATTERN = new RegExp(`^${OPERATOR_KEY_PREFIX}(${OPERATOR_KEY_ID_PATTERN})_${OPERATOR_KEY_SECRET_PATTERN}$`);
export const OPERATOR_KEY_DEFAULT_LIFETIME_DAYS = 90;
export const OPERATOR_KEY_MAX_LIFETIME_DAYS = 365;
export const OPERATOR_KEY_DEFAULT_LIFETIME_MS = OPERATOR_KEY_DEFAULT_LIFETIME_DAYS * DAY_MS;
export const OPERATOR_KEY_LIST_LIMIT = 100;
export const OPERATOR_KEY_LAST_USED_INTERVAL_MS = MINUTE_MS;
export const OPERATOR_MCP_AUDIT_LIMIT = 100;
export const OPERATOR_MCP_PAGE_LIMIT = 100;
export const OPERATOR_MCP_SERVER_NAME = 'zapbip-backoffice';
export const OPERATOR_MCP_DEFAULT_PAGE_SIZE = 20;
export const OPERATOR_MCP_INSTRUCTIONS =
  'Operator tools for the zapbip backoffice. Deleting accounts, connecting WhatsApp numbers and handling credentials are human-only and have no tool here. A tool that changes anything needs confirm: true, takes a small batch and writes an audit row under this key.';
export const OPERATOR_MCP_METHOD = 'POST';
export const OPERATOR_MCP_ALLOW_HEADER = 'Allow';
export const OPERATOR_MCP_RATE_LIMITED_BODY = { error: 'rate_limited' } as const;
export const OPERATOR_MCP_METHOD_NOT_ALLOWED_BODY = { error: 'method_not_allowed' } as const;

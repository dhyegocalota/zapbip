import { CLIENT_APP_SESSION_TTL_MS, CLIENT_APP_TOKEN_LENGTH, SECOND_MS } from '@zapbip/types';

export const SESSION_COOKIE_NAME = '__Host-zapbip_app';
export const SESSION_COOKIE_MAX_AGE_SECONDS = CLIENT_APP_SESSION_TTL_MS / SECOND_MS;
export const CSRF_FIELD = 'csrf';
export const AGENT_NAME_FIELD = 'agentName';
export const AGENT_FIELD = 'agent';
export const CONFIRM_FIELD = 'confirm';
export const CONFIRM_VALUE = 'yes';
export const NOTICE_PARAMETER = 'notice';
export const ORIGIN_HEADER = 'Origin';
export const CSRF_CONTEXT = 'zapbip client app csrf';
export const SIGN_IN_RATE_KEY_PREFIX = 'app-sign-in:';
export const SIGN_IN_TOKEN_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${CLIENT_APP_TOKEN_LENGTH}}$`);
export const ISO_DATE_LENGTH = 10;
export const BRAND_SEPARATOR = ' · ';
export const DELETE_ACCOUNT_DOCS_PATH = '/help/delete-your-account';
export const DOCS_PORTUGUESE_PATH = '/pt-br';
export const THEME_COLOR_LIGHT = '#F6F8F5';
export const THEME_COLOR_DARK = '#07120F';
export const STYLESHEET_CONTENT_TYPE = 'text/css; charset=utf-8';
export const CLIENT_APP_ERROR_CODE = 'ClientAppError';

export enum ClientAppNotice {
  Revoked = 'revoked',
  AgentMissing = 'agent_missing',
}

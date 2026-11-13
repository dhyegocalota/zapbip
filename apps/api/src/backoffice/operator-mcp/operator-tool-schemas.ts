import { OwnerLocale } from '@zapbip/types';
import { z } from 'zod';
import { OPERATOR_MCP_AUDIT_LIMIT, OPERATOR_MCP_DEFAULT_PAGE_SIZE, OPERATOR_MCP_PAGE_LIMIT } from './operator-mcp-constants';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dayField = z.string().regex(DAY_PATTERN).nullable().default(null);
const localeField = z.enum(OwnerLocale).nullable().default(null);
const confirmField = z.boolean().nullable().default(null);
const limitField = z.number().int().min(1).max(OPERATOR_MCP_PAGE_LIMIT).default(OPERATOR_MCP_DEFAULT_PAGE_SIZE);

export const metricsSummaryInputShape = {};
export const listWaitlistInputShape = {
  from: dayField,
  to: dayField,
  locale: localeField,
  limit: limitField,
  offset: z.number().int().min(0).default(0),
};
export const listWaitingAccountsInputShape = { from: dayField, to: dayField, locale: localeField, limit: limitField };
export const releaseAccessInputShape = { accountIds: z.array(z.string().min(1)).min(1), confirm: confirmField };
export const inviteWaitlistInputShape = { entryIds: z.array(z.string().min(1)).min(1), confirm: confirmField };
export const listAuditInputShape = {
  limit: z.number().int().min(1).max(OPERATOR_MCP_AUDIT_LIMIT).default(OPERATOR_MCP_DEFAULT_PAGE_SIZE),
};

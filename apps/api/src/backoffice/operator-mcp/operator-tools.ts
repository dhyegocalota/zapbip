import { ACCESS_BATCH_LIMIT } from '@zapbip/types';
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ZodRawShape } from 'zod';
import { maskedPhoneOf } from '../../client-app/masked-phone';
import { auditedBatch, type BatchAuditRecorder } from '../access/access-audit';
import { parseAccessFilter } from '../access/access-filter';
import { inviteCountsOf, issueInvites, startNumberOf } from '../access/access-invite';
import { countInvitableEntries, countWaitingAccounts, listInvitableEntries, listWaitingAccounts } from '../access/access-queries';
import { releaseBatch, releaseCountsOf } from '../access/access-release';
import { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import { accessWindowFigures, accessWindowOf, waitlistTotalOf } from '../metrics/access-metrics';
import { ACCESS_MONTH_DAYS, ACCESS_WEEK_DAYS, MetricsPeriod } from '../metrics/metrics-filter';
import { readMetrics } from '../metrics/metrics-queries';
import { OPERATOR_MCP_MAX_OFFSET } from './operator-mcp-constants';
import { agentAuditRecorder, writeAgentAudit, type AgentAuditActor } from './operator-audit';
import { OperatorToolRefusal, OperatorToolRefusalCode } from './operator-tool-refusal';
import {
  inviteWaitlistInputShape,
  listAuditInputShape,
  listWaitingAccountsInputShape,
  listWaitlistInputShape,
  metricsSummaryInputShape,
  releaseAccessInputShape,
} from './operator-tool-schemas';
import { listAuditPage } from './operator-queries';

export type OperatorToolContext = AgentAuditActor;

export type OperatorToolDefinition<Shape extends ZodRawShape> = {
  description: string;
  inputShape: Shape;
  handler: (input: { context: OperatorToolContext; arguments: ShapeOutput<Shape> }) => Promise<Record<string, unknown>>;
};

function toolOf<Shape extends ZodRawShape>(definition: OperatorToolDefinition<Shape>): OperatorToolDefinition<Shape> {
  return definition;
}

function isoOf(input: { at: number }): string {
  return new Date(input.at).toISOString();
}

// NB ADR 0046: a writing tool needs confirm: true and takes at most ACCESS_BATCH_LIMIT ids.
function confirmedBatchOf(input: { ids: string[]; confirm: boolean | null }): string[] {
  if (input.confirm !== true)
    throw new OperatorToolRefusal({ code: OperatorToolRefusalCode.ConfirmRequired, message: 'pass confirm: true to run this tool' });
  const ids = [...new Set(input.ids)];
  if (ids.length > ACCESS_BATCH_LIMIT)
    throw new OperatorToolRefusal({ code: OperatorToolRefusalCode.BatchTooLarge, message: `at most ${ACCESS_BATCH_LIMIT} per call` });
  return ids;
}

function recorderOf(input: { context: OperatorToolContext }): BatchAuditRecorder {
  return agentAuditRecorder({ actor: input.context });
}

export const METRICS_SUMMARY_TOOL = toolOf({
  description:
    'The figures of the Metrics page for the 7 and 30 day windows: accounts by state, agents, waitlist, invites and released access.',
  inputShape: metricsSummaryInputShape,
  handler: async ({ context }) => {
    const now = Date.now();
    const { access, accountsByState, agents, blockedPhones } = await readMetrics({
      database: context.bindings.CONNECTIONS,
      filter: { numberId: null, period: MetricsPeriod.Month },
      now,
    });
    const windowOf = (dayCount: number) => accessWindowFigures({ access, now, window: accessWindowOf({ access, dayCount }) });
    return {
      accountsByState: Object.fromEntries(accountsByState.map((entry) => [entry.state, entry.total])),
      agents,
      blockedPhones,
      access: {
        waitlistTotal: waitlistTotalOf({ access }),
        invites: access.inviteTotals,
        releasedAllTime: access.releasedAllTime,
        windows: { sevenDays: windowOf(ACCESS_WEEK_DAYS), thirtyDays: windowOf(ACCESS_MONTH_DAYS) },
      },
    };
  },
});

export const LIST_WAITLIST_TOOL = toolOf({
  description: `Email waitlist entries not yet invited that joined through the site form, oldest first, one page at a time (offset up to ${OPERATOR_MCP_MAX_OFFSET}). Each call is audited under this key. The entryId is what invite_waitlist takes.`,
  inputShape: listWaitlistInputShape,
  handler: async ({ context, arguments: { from, to, locale, limit, offset } }) => {
    const database = context.bindings.CONNECTIONS;
    const filter = parseAccessFilter({ from, to, locale, source: null });
    const now = Date.now();
    const [total, rows] = await Promise.all([
      countInvitableEntries({ database, filter, now }),
      listInvitableEntries({ database, filter, now, limit, offset }),
    ]);
    await writeAgentAudit({
      actor: context,
      action: BackofficeAuditAction.WaitlistListed,
      outcome: BackofficeAuditOutcome.Succeeded,
      targetKind: BackofficeAuditTargetKind.Waitlist,
      targetId: `offset=${offset} limit=${limit} returned=${rows.length}`,
    });
    return { total, entries: rows.map((row) => ({ entryId: row.email, joinedAt: isoOf({ at: row.joinedAt }), locale: row.locale })) };
  },
});

export const LIST_WAITING_ACCOUNTS_TOOL = toolOf({
  description: 'WhatsApp accounts waiting for release, oldest first, with masked phones. The accountId is what release_access takes.',
  inputShape: listWaitingAccountsInputShape,
  handler: async ({ context, arguments: { from, to, locale, limit } }) => {
    const database = context.bindings.CONNECTIONS;
    const filter = parseAccessFilter({ from, to, locale, source: null });
    const [total, rows] = await Promise.all([countWaitingAccounts({ database, filter }), listWaitingAccounts({ database, filter, limit })]);
    return {
      total,
      accounts: rows.map((row) => ({
        accountId: row.accountId,
        maskedPhone: maskedPhoneOf({ waId: row.waId }),
        joinedAt: isoOf({ at: row.joinedAt }),
        locale: row.locale,
      })),
    };
  },
});

export const RELEASE_ACCESS_TOOL = toolOf({
  description: `Move waitlisted accounts to active and notify their owners, at most ${ACCESS_BATCH_LIMIT} per call. Requires confirm: true.`,
  inputShape: releaseAccessInputShape,
  handler: async ({ context, arguments: { accountIds, confirm } }) => {
    const selected = confirmedBatchOf({ ids: accountIds, confirm });
    const { rows, counts } = await auditedBatch({
      record: recorderOf({ context }),
      action: BackofficeAuditAction.AccessReleased,
      selected: selected.length,
      run: async () => {
        const released = await releaseBatch({ bindings: context.bindings, accountIds: selected, now: Date.now() });
        return { rows: released, counts: releaseCountsOf({ rows: released }) };
      },
    });
    return { counts, accounts: rows.map((row) => ({ accountId: row.accountId, outcome: row.outcome, notice: row.notice })) };
  },
});

export const INVITE_WAITLIST_TOOL = toolOf({
  description: `Issue single-use invite links to email waitlist entries, at most ${ACCESS_BATCH_LIMIT} per call. The links are returned once, to this key only. Requires confirm: true.`,
  inputShape: inviteWaitlistInputShape,
  handler: async ({ context, arguments: { entryIds, confirm } }) => {
    const selected = confirmedBatchOf({ ids: entryIds, confirm });
    const displayNumber = await startNumberOf({ bindings: context.bindings });
    if (displayNumber === null)
      throw new OperatorToolRefusal({ code: OperatorToolRefusalCode.NoStartNumber, message: 'no active number can carry the invite link' });
    const { invites, counts } = await auditedBatch({
      record: recorderOf({ context }),
      action: BackofficeAuditAction.WaitlistInvited,
      selected: selected.length,
      run: async () => {
        const issued = await issueInvites({ bindings: context.bindings, emails: selected, displayNumber, now: Date.now() });
        return { invites: issued, counts: inviteCountsOf({ selected: selected.length, issued }) };
      },
    });
    return { counts, invites: invites.map((invite) => ({ entryId: invite.email, link: invite.link })) };
  },
});

export const LIST_AUDIT_TOOL = toolOf({
  description: 'The newest backoffice audit rows, with the agent key that acted when there is one.',
  inputShape: listAuditInputShape,
  handler: async ({ context, arguments: { limit } }) => {
    const rows = await listAuditPage({ database: context.bindings.CONNECTIONS, limit });
    return { rows: rows.map((row) => ({ ...row, at: isoOf({ at: row.at }) })) };
  },
});

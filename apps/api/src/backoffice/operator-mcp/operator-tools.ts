import { ACCESS_BATCH_LIMIT } from '@zapbip/types';
import { z, type ZodRawShape } from 'zod';
import { maskedPhoneOf } from '../../client-app/masked-phone';
import type { Bindings } from '../../contract/env';
import { auditedBatch, type BatchAuditRecorder } from '../access/access-audit';
import { parseAccessFilter } from '../access/access-filter';
import { inviteCountsOf, issueInvites, startNumberOf } from '../access/access-invite';
import { countWaitingAccounts, listWaitingAccounts } from '../access/access-queries';
import { releaseBatch, releaseCountsOf } from '../access/access-release';
import { BackofficeAuditAction } from '../audit/backoffice-audit-action';
import { accessWindowFigures, accessWindowOf, waitlistTotalOf } from '../metrics/access-metrics';
import { ACCESS_MONTH_DAYS, ACCESS_WEEK_DAYS, MetricsPeriod } from '../metrics/metrics-filter';
import { readMetrics } from '../metrics/metrics-queries';
import { agentAuditRecorder } from './operator-audit';
import { OperatorToolRefusal, OperatorToolRefusalCode } from './operator-tool-refusal';
import { OperatorToolName } from './operator-tool-name';
import {
  inviteWaitlistInputShape,
  listAuditInputShape,
  listWaitingAccountsInputShape,
  listWaitlistInputShape,
  metricsSummaryInputShape,
  releaseAccessInputShape,
} from './operator-tool-schemas';
import { countWaitlistPage, listAuditPage, listWaitlistPage } from './operator-queries';

export type OperatorToolContext = { bindings: Bindings; keyId: string; clientAddress: string | null };

export type OperatorToolDefinition = {
  description: string;
  inputShape: ZodRawShape;
  handler: (input: { context: OperatorToolContext; arguments: never }) => Promise<Record<string, unknown>>;
};

function toolOf<Shape extends ZodRawShape>(input: {
  description: string;
  inputShape: Shape;
  handler: (input: { context: OperatorToolContext; arguments: z.infer<z.ZodObject<Shape>> }) => Promise<Record<string, unknown>>;
}): OperatorToolDefinition {
  return input;
}

function isoOf(input: { at: number }): string {
  return new Date(input.at).toISOString();
}

function confirmedBatchOf(input: { ids: string[]; confirm: boolean | null }): string[] {
  if (input.confirm !== true)
    throw new OperatorToolRefusal({ code: OperatorToolRefusalCode.ConfirmRequired, message: 'pass confirm: true to run this tool' });
  const ids = [...new Set(input.ids)];
  if (ids.length > ACCESS_BATCH_LIMIT)
    throw new OperatorToolRefusal({ code: OperatorToolRefusalCode.BatchTooLarge, message: `at most ${ACCESS_BATCH_LIMIT} per call` });
  return ids;
}

function recorderOf(input: { context: OperatorToolContext }): BatchAuditRecorder {
  const { bindings, keyId, clientAddress } = input.context;
  return agentAuditRecorder({ bindings, keyId, clientAddress });
}

const METRICS_SUMMARY = toolOf({
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

const LIST_WAITLIST = toolOf({
  description: 'The email waitlist, oldest first, one page at a time. The entryId is what invite_waitlist takes.',
  inputShape: listWaitlistInputShape,
  handler: async ({ context, arguments: { from, to, locale, limit, offset } }) => {
    const database = context.bindings.CONNECTIONS;
    const filter = parseAccessFilter({ from, to, locale });
    const [total, rows] = await Promise.all([
      countWaitlistPage({ database, filter }),
      listWaitlistPage({ database, filter, limit, offset }),
    ]);
    return { total, entries: rows.map((row) => ({ ...row, joinedAt: isoOf({ at: row.joinedAt }) })) };
  },
});

const LIST_WAITING_ACCOUNTS = toolOf({
  description: 'WhatsApp accounts waiting for release, oldest first, with masked phones. The accountId is what release_access takes.',
  inputShape: listWaitingAccountsInputShape,
  handler: async ({ context, arguments: { from, to, locale, limit } }) => {
    const database = context.bindings.CONNECTIONS;
    const filter = parseAccessFilter({ from, to, locale });
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

const RELEASE_ACCESS = toolOf({
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

const INVITE_WAITLIST = toolOf({
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

const LIST_AUDIT = toolOf({
  description: 'The newest backoffice audit rows, with the agent key that acted when there is one.',
  inputShape: listAuditInputShape,
  handler: async ({ context, arguments: { limit } }) => {
    const rows = await listAuditPage({ database: context.bindings.CONNECTIONS, limit });
    return { rows: rows.map((row) => ({ ...row, at: isoOf({ at: row.at }) })) };
  },
});

export const OPERATOR_TOOLS: Record<OperatorToolName, OperatorToolDefinition> = {
  [OperatorToolName.MetricsSummary]: METRICS_SUMMARY,
  [OperatorToolName.ListWaitlist]: LIST_WAITLIST,
  [OperatorToolName.ListWaitingAccounts]: LIST_WAITING_ACCOUNTS,
  [OperatorToolName.ReleaseAccess]: RELEASE_ACCESS,
  [OperatorToolName.InviteWaitlist]: INVITE_WAITLIST,
  [OperatorToolName.ListAudit]: LIST_AUDIT,
};

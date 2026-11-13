import { ACCESS_BATCH_LIMIT, HttpStatus } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { numberRegistryOf } from '../../adapters/d1/d1-number-registry';
import { whatsappLinkTarget } from '../../routes/start-link-target';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import { StepUpOutcome } from '../auth/step-up';
import { ACCESS_PAGE_ROW_LIMIT } from '../backoffice-constants';
import { BackofficeCopyKey } from '../backoffice-copy';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';
import { type FormBody, textFieldOf, textFieldsOf } from '../form-fields';
import { type FlashStatus, redirectWithFlash, takeFlash } from '../flash/form-flash';
import { rateLimitedResponse, stepUpOf } from '../numbers/step-up-gate';
import { signedInPageContext } from '../page-context';
import { auditTargetOf } from './access-batch-counts';
import { parseAccessFilter, type AccessFilter } from './access-filter';
import { AccessFormField } from './access-form-fields';
import { inviteCountsOf, issueInvites } from './access-invite';
import { AccessPage } from './access-page';
import { countInvitableEntries, countWaitingAccounts, listInvitableEntries, listWaitingAccounts } from './access-queries';
import { releaseBatch, releaseCountsOf } from './access-release';
import { AccessInviteResultPage, AccessReleaseResultPage } from './access-result-pages';
import { parseInviteLines, toInvitesCsv } from './invite-csv';

const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
const ISO_DAY_LENGTH = 10;
const SELECT_ALL_VALUE = '1';
const RELEASE_TARGET = 'release';
const INVITE_TARGET = 'invite';
const TARGET_KIND = BackofficeAuditTargetKind.Access;

export const accessRoutes = new Hono<BackofficeEnv>();

function filterOf(input: { read: (name: AccessFormField) => string | null }): AccessFilter {
  const { read } = input;
  return parseAccessFilter({ from: read(AccessFormField.From), to: read(AccessFormField.To), locale: read(AccessFormField.Locale) });
}

function rejectAccess(input: { context: Context<BackofficeEnv>; status: FlashStatus; failure: BackofficeCopyKey }): Promise<Response> {
  const { context, status, failure } = input;
  return redirectWithFlash({
    context,
    path: BackofficePath.Access,
    flash: { status, failure, errors: {}, onboarding: null, selectedState: null },
  });
}

function selectionFailureOf(input: { selected: string[] }): BackofficeCopyKey | null {
  if (input.selected.length === 0) return BackofficeCopyKey.AccessNothingSelected;
  return input.selected.length > ACCESS_BATCH_LIMIT ? BackofficeCopyKey.AccessBatchTooLarge : null;
}

async function auditBatch(input: {
  context: Context<BackofficeEnv>;
  action: BackofficeAuditAction;
  counts: Record<string, number>;
}): Promise<void> {
  const { context, action, counts } = input;
  await writeAudit({
    database: context.env.CONNECTIONS,
    entry: {
      now: Date.now(),
      action,
      outcome: BackofficeAuditOutcome.Succeeded,
      targetKind: TARGET_KIND,
      targetId: auditTargetOf({ counts }),
      clientAddress: context.get('clientAddress'),
    },
  });
}

function nullIfAbsent(input: { value: string | undefined }): string | null {
  return input.value === undefined ? null : input.value;
}

async function startNumberOf(input: { context: Context<BackofficeEnv> }): Promise<string | null> {
  const displayNumber = await numberRegistryOf({ bindings: input.context.env }).findStartDisplayNumber();
  if (displayNumber === null) return null;
  return whatsappLinkTarget({ displayNumber, text: '' }) === null ? null : displayNumber;
}

function uniqueOf(input: { values: string[] }): string[] {
  return [...new Set(input.values)];
}

accessRoutes.get(BackofficePath.Access, async (context) => {
  const database = context.env.CONNECTIONS;
  const now = Date.now();
  const filter = filterOf({ read: (name) => nullIfAbsent({ value: context.req.query(name) }) });
  const flash = await takeFlash({ context, path: BackofficePath.Access });
  const [waitingTotal, waitingRows, invitableTotal, invitableRows] = await Promise.all([
    countWaitingAccounts({ database, filter }),
    listWaitingAccounts({ database, filter, limit: ACCESS_PAGE_ROW_LIMIT }),
    countInvitableEntries({ database, filter, now }),
    listInvitableEntries({ database, filter, now, limit: ACCESS_PAGE_ROW_LIMIT }),
  ]);
  return context.html(
    <AccessPage
      page={await signedInPageContext({ context })}
      filter={filter}
      failure={flash === null ? null : flash.failure}
      waiting={{ total: waitingTotal, rows: waitingRows }}
      invitable={{ total: invitableTotal, rows: invitableRows }}
    />,
    flash === null ? HttpStatus.Ok : flash.status,
  );
});

async function selectedAccountIds(input: { context: Context<BackofficeEnv>; form: FormBody; filter: AccessFilter }): Promise<string[]> {
  const { context, form, filter } = input;
  if (textFieldOf({ form, name: AccessFormField.SelectAll }) !== SELECT_ALL_VALUE)
    return uniqueOf({ values: textFieldsOf({ form, name: AccessFormField.Account }) });
  const rows = await listWaitingAccounts({ database: context.env.CONNECTIONS, filter, limit: ACCESS_BATCH_LIMIT });
  return rows.map((row) => row.accountId);
}

async function selectedEmails(input: { context: Context<BackofficeEnv>; form: FormBody; filter: AccessFilter }): Promise<string[]> {
  const { context, form, filter } = input;
  if (textFieldOf({ form, name: AccessFormField.SelectAll }) !== SELECT_ALL_VALUE)
    return uniqueOf({ values: textFieldsOf({ form, name: AccessFormField.Email }) });
  const rows = await listInvitableEntries({ database: context.env.CONNECTIONS, filter, now: Date.now(), limit: ACCESS_BATCH_LIMIT });
  return rows.map((row) => row.email);
}

accessRoutes.post(BackofficePath.AccessRelease, async (context) => {
  const form = await context.req.parseBody({ all: true });
  const filter = filterOf({ read: (name) => textFieldOf({ form, name }) });
  const accountIds = await selectedAccountIds({ context, form, filter });
  const failure = selectionFailureOf({ selected: accountIds });
  if (failure !== null) return rejectAccess({ context, status: HttpStatus.UnprocessableEntity, failure });
  const outcome = await stepUpOf({ context, form, targetKind: TARGET_KIND, targetId: RELEASE_TARGET });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected)
    return rejectAccess({ context, status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  const rows = await releaseBatch({ bindings: context.env, accountIds, now: Date.now() });
  const counts = releaseCountsOf({ rows });
  await auditBatch({ context, action: BackofficeAuditAction.AccessReleased, counts });
  return context.html(<AccessReleaseResultPage page={await signedInPageContext({ context })} counts={counts} rows={rows} />, HttpStatus.Ok);
});

accessRoutes.post(BackofficePath.AccessInvite, async (context) => {
  const form = await context.req.parseBody({ all: true });
  const filter = filterOf({ read: (name) => textFieldOf({ form, name }) });
  const emails = await selectedEmails({ context, form, filter });
  const failure = selectionFailureOf({ selected: emails });
  if (failure !== null) return rejectAccess({ context, status: HttpStatus.UnprocessableEntity, failure });
  const displayNumber = await startNumberOf({ context });
  if (displayNumber === null)
    return rejectAccess({ context, status: HttpStatus.UnprocessableEntity, failure: BackofficeCopyKey.AccessNoStartNumber });
  const outcome = await stepUpOf({ context, form, targetKind: TARGET_KIND, targetId: INVITE_TARGET });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected)
    return rejectAccess({ context, status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  const invites = await issueInvites({ bindings: context.env, emails, displayNumber, now: Date.now() });
  const counts = inviteCountsOf({ selected: emails.length, issued: invites });
  await auditBatch({ context, action: BackofficeAuditAction.WaitlistInvited, counts });
  return context.html(
    <AccessInviteResultPage page={await signedInPageContext({ context })} counts={counts} invites={invites} />,
    HttpStatus.Ok,
  );
});

accessRoutes.post(BackofficePath.AccessInvitesCsv, async (context) => {
  const form = await context.req.parseBody();
  const lines = textFieldOf({ form, name: AccessFormField.Links });
  if (lines === null)
    return rejectAccess({ context, status: HttpStatus.UnprocessableEntity, failure: BackofficeCopyKey.AccessNothingSelected });
  const invites = parseInviteLines({ lines });
  const failure = selectionFailureOf({ selected: invites.map((invite) => invite.email) });
  if (failure !== null) return rejectAccess({ context, status: HttpStatus.UnprocessableEntity, failure });
  const day = new Date(Date.now()).toISOString().slice(0, ISO_DAY_LENGTH);
  return context.body(toInvitesCsv({ invites }), HttpStatus.Ok, {
    'Content-Type': CSV_CONTENT_TYPE,
    'Content-Disposition': `attachment; filename="zapbip-invites-${day}.csv"`,
  });
});

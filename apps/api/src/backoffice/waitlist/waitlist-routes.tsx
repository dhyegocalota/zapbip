import { HttpStatus, SiteSettingKey } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { readReferralCap, writeReferralCap } from '../../site/site-settings';
import { writeAudit } from '../audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome, BackofficeAuditTargetKind } from '../audit/backoffice-audit-action';
import { StepUpOutcome } from '../auth/step-up';
import { SEE_OTHER_STATUS, WAITLIST_PAGE_ROW_LIMIT } from '../backoffice-constants';
import { BackofficeCopyKey } from '../backoffice-copy';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficeNotice } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { textFieldOf } from '../form-fields';
import { type FlashStatus, redirectWithFlash, takeFlash } from '../flash/form-flash';
import { withNotice } from '../numbers/number-paths';
import { rateLimitedResponse, stepUpOf } from '../numbers/step-up-gate';
import { signedInPageContext } from '../page-context';
import { parseReferralCap } from './referral-cap-settings';
import { toWaitlistCsv } from './waitlist-csv';
import { WaitlistFormField } from './waitlist-form-fields';
import { countWaitlist, listWaitlist, NO_ROW_LIMIT } from './waitlist-queries';
import { WaitlistPage } from './waitlist-page';

const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
const ISO_DAY_LENGTH = 10;
const TARGET_KIND = BackofficeAuditTargetKind.Waitlist;

export const waitlistRoutes = new Hono<BackofficeEnv>();

function rejectCap(input: { context: Context<BackofficeEnv>; status: FlashStatus; failure: BackofficeCopyKey | null }): Promise<Response> {
  const { context, status, failure } = input;
  const errors = status === HttpStatus.UnprocessableEntity ? { [WaitlistFormField.Cap]: BackofficeCopyKey.FieldErrorCapRange } : {};
  return redirectWithFlash({
    context,
    path: BackofficePath.Waitlist,
    flash: { status, failure, errors, onboarding: null, selectedState: null },
  });
}

async function auditWaitlist(input: {
  context: Context<BackofficeEnv>;
  action: BackofficeAuditAction;
  targetId: string | null;
}): Promise<void> {
  const { context, action, targetId } = input;
  await writeAudit({
    database: context.env.CONNECTIONS,
    entry: {
      now: Date.now(),
      action,
      outcome: BackofficeAuditOutcome.Succeeded,
      targetKind: TARGET_KIND,
      targetId,
      clientAddress: context.get('clientAddress'),
    },
  });
}

waitlistRoutes.get(BackofficePath.Waitlist, async (context) => {
  const database = context.env.CONNECTIONS;
  const flash = await takeFlash({ context, path: BackofficePath.Waitlist });
  const [total, rows, cap] = await Promise.all([
    countWaitlist({ database }),
    listWaitlist({ database, limit: WAITLIST_PAGE_ROW_LIMIT }),
    readReferralCap({ database }).catch(() => null),
  ]);
  const page = await signedInPageContext({ context });
  const capErrorKey = flash === null ? undefined : flash.errors[WaitlistFormField.Cap];
  return context.html(
    <WaitlistPage
      page={page}
      total={total}
      rows={rows}
      cap={cap}
      failure={flash === null ? null : flash.failure}
      capError={capErrorKey === undefined ? null : capErrorKey}
    />,
    flash === null ? HttpStatus.Ok : flash.status,
  );
});

waitlistRoutes.get(BackofficePath.WaitlistExport, async (context) => {
  const rows = await listWaitlist({ database: context.env.CONNECTIONS, limit: NO_ROW_LIMIT });
  await auditWaitlist({ context, action: BackofficeAuditAction.WaitlistExported, targetId: null });
  const day = new Date(Date.now()).toISOString().slice(0, ISO_DAY_LENGTH);
  return context.body(toWaitlistCsv({ rows, locale: context.get('locale') }), HttpStatus.Ok, {
    'Content-Type': CSV_CONTENT_TYPE,
    'Content-Disposition': `attachment; filename="zapbip-waitlist-${day}.csv"`,
  });
});

waitlistRoutes.post(BackofficePath.WaitlistCap, async (context) => {
  const form = await context.req.parseBody();
  const cap = parseReferralCap({ value: textFieldOf({ form, name: WaitlistFormField.Cap }) });
  if (cap === null) return rejectCap({ context, status: HttpStatus.UnprocessableEntity, failure: null });
  const outcome = await stepUpOf({ context, form, targetKind: TARGET_KIND, targetId: SiteSettingKey.WaitlistReferralCap });
  if (outcome === StepUpOutcome.RateLimited) return rateLimitedResponse({ context });
  if (outcome === StepUpOutcome.Rejected)
    return rejectCap({ context, status: HttpStatus.Unauthorized, failure: BackofficeCopyKey.StepUpRejected });
  await writeReferralCap({ database: context.env.CONNECTIONS, value: cap, now: Date.now() });
  await auditWaitlist({ context, action: BackofficeAuditAction.ReferralCapChanged, targetId: SiteSettingKey.WaitlistReferralCap });
  return context.redirect(withNotice({ path: BackofficePath.Waitlist, notice: BackofficeNotice.WaitlistCapSaved }), SEE_OTHER_STATUS);
});

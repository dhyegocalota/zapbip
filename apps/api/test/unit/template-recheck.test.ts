import { describe, expect, it, vi } from 'vitest';
import { GraphRequestError, type GraphClient } from '../../src/adapters/whatsapp/graph-client';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from '../../src/adapters/whatsapp/whatsapp-enums';
import type { NumberAdmin, NumberListEntry } from '../../src/numbers/number-admin';
import { recheckPendingTemplates } from '../../src/numbers/template-recheck';
import { TemplateStatus, VerificationOutcome, type TemplateEntry, type VerificationSnapshot } from '../../src/numbers/number-verification';
import { SCHEDULED_JOBS, ScheduledJobName } from '../../src/operations/scheduled';
import { TEMPLATE_RECHECK_MINUTE } from '../../src/operations/constants';

const NOW = 1_800_000_000_000;
const EARLIER = 1_700_000_000_000;
const DISPLAY_NUMBER = '+5511900000001';

function snapshotWith(input: { statuses: TemplateStatus[] }): VerificationSnapshot {
  const templates: TemplateEntry[] = input.statuses.map((status) => ({
    name: WhatsAppTemplateName.AgentNotice,
    language: WhatsAppLanguageCode.EnglishUs,
    status,
  }));
  return {
    outcome: VerificationOutcome.Verified,
    errorKind: null,
    expectedDigits: '5511900000001',
    reportedDigits: '5511900000001',
    verifiedName: null,
    qualityRating: null,
    templates,
    checkedAt: EARLIER,
  };
}

function entryOf(input: { numberId: string; snapshot: VerificationSnapshot | null; displayNumber?: string }): NumberListEntry {
  return {
    numberId: input.numberId,
    phoneNumberId: `phone-${input.numberId}`,
    wabaId: `waba-${input.numberId}`,
    displayNumber: input.displayNumber === undefined ? DISPLAY_NUMBER : input.displayNumber,
    verificationSnapshot: input.snapshot === null ? null : JSON.stringify(input.snapshot),
    verifiedAt: EARLIER,
  } as NumberListEntry;
}

function graphReporting(input: { displayNumber: string; approvedEverywhere?: boolean }): GraphClient {
  return {
    get: async ({ path }) => {
      if (path.includes('message_templates')) return { data: [] };
      return { display_phone_number: input.displayNumber };
    },
    post: async () => ({ id: 'created' }),
    download: () => Promise.reject(new Error('unexpected download')),
  };
}

function fakeAdmin(input: { entries: NumberListEntry[] }) {
  const recordVerification = vi.fn(async () => undefined);
  const admin: NumberAdmin = {
    listNumbers: async () => input.entries,
    recordVerification,
    replaceAccessToken: () => Promise.reject(new Error('unexpected replaceAccessToken')),
    openTwoStepPin: () => Promise.reject(new Error('unexpected openTwoStepPin')),
  };
  return { admin, recordVerification };
}

describe('template recheck', () => {
  it('rechecks only numbers whose stored snapshot has a template that is not approved', async () => {
    const { admin, recordVerification } = fakeAdmin({
      entries: [
        entryOf({ numberId: 'never-verified', snapshot: null }),
        entryOf({ numberId: 'all-approved', snapshot: snapshotWith({ statuses: [TemplateStatus.Approved] }) }),
        entryOf({ numberId: 'waiting', snapshot: snapshotWith({ statuses: [TemplateStatus.Approved, TemplateStatus.Pending] }) }),
      ],
    });
    const openGraph = vi.fn(async () => graphReporting({ displayNumber: DISPLAY_NUMBER }));
    await recheckPendingTemplates({ admin, openGraph, now: NOW });
    expect(openGraph).toHaveBeenCalledTimes(1);
    expect(openGraph).toHaveBeenCalledWith({ numberId: 'waiting' });
    expect(recordVerification).toHaveBeenCalledTimes(1);
  });

  it('stores the new snapshot and keeps verifiedAt where it was', async () => {
    const { admin, recordVerification } = fakeAdmin({
      entries: [entryOf({ numberId: 'waiting', snapshot: snapshotWith({ statuses: [TemplateStatus.Missing] }) })],
    });
    await recheckPendingTemplates({ admin, openGraph: async () => graphReporting({ displayNumber: DISPLAY_NUMBER }), now: NOW });
    const [call] = recordVerification.mock.calls as unknown as [[{ numberId: string; snapshot: string; verifiedAt: number | null }]];
    expect(call[0]).toMatchObject({ numberId: 'waiting', verifiedAt: null });
    expect(JSON.parse(call[0].snapshot)).toMatchObject({ outcome: VerificationOutcome.Verified, checkedAt: NOW });
  });

  it('records nothing when the outcome is no longer verified', async () => {
    const { admin, recordVerification } = fakeAdmin({
      entries: [entryOf({ numberId: 'waiting', snapshot: snapshotWith({ statuses: [TemplateStatus.Pending] }) })],
    });
    await recheckPendingTemplates({ admin, openGraph: async () => graphReporting({ displayNumber: '+55 11 99999-9999' }), now: NOW });
    expect(recordVerification).not.toHaveBeenCalled();
  });

  it('records nothing when Meta cannot be reached', async () => {
    const { admin, recordVerification } = fakeAdmin({
      entries: [entryOf({ numberId: 'waiting', snapshot: snapshotWith({ statuses: [TemplateStatus.Pending] }) })],
    });
    const unreachable: GraphClient = {
      get: () => Promise.reject(new GraphRequestError({ status: 500, errorCode: null, errorTitle: null, message: 'down' })),
      post: () => Promise.reject(new Error('unexpected post')),
      download: () => Promise.reject(new Error('unexpected download')),
    };
    await recheckPendingTemplates({ admin, openGraph: async () => unreachable, now: NOW });
    expect(recordVerification).not.toHaveBeenCalled();
  });

  it('keeps going after one number fails and then re-throws', async () => {
    const { admin, recordVerification } = fakeAdmin({
      entries: [
        entryOf({ numberId: 'broken', snapshot: snapshotWith({ statuses: [TemplateStatus.Pending] }) }),
        entryOf({ numberId: 'healthy', snapshot: snapshotWith({ statuses: [TemplateStatus.Pending] }) }),
      ],
    });
    const openGraph = async ({ numberId }: { numberId: string }): Promise<GraphClient> => {
      if (numberId === 'broken') throw new Error('cannot open broken');
      return graphReporting({ displayNumber: DISPLAY_NUMBER });
    };
    await expect(recheckPendingTemplates({ admin, openGraph, now: NOW })).rejects.toThrow('cannot open broken');
    expect(recordVerification).toHaveBeenCalledTimes(1);
  });
});

describe('template recheck schedule', () => {
  it('is due once an hour at its minute and at no other half hour tick', () => {
    const job = SCHEDULED_JOBS[ScheduledJobName.TemplateRecheck];
    expect(job.isDue({ now: Date.UTC(2026, 10, 14, 9, TEMPLATE_RECHECK_MINUTE) })).toBe(true);
    expect(job.isDue({ now: Date.UTC(2026, 10, 14, 9, 0) })).toBe(false);
  });
});

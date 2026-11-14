import type { NumberAdmin, NumberListEntry } from './number-admin';
import { numberAdminOf } from '../adapters/d1/d1-number-admin';
import { numberRegistryOf } from '../adapters/d1/d1-number-registry';
import { createGraphClient, type GraphClient } from '../adapters/whatsapp/graph-client';
import { readWhatsAppEnvironment } from '../adapters/whatsapp/read-whatsapp-env';
import type { Bindings } from '../contract/env';
import {
  parseVerificationSnapshot,
  TemplateStatus,
  VerificationOutcome,
  verifyNumber,
  type VerificationSnapshot,
} from './number-verification';

function hasUnapprovedTemplate(input: { snapshot: VerificationSnapshot }): boolean {
  return input.snapshot.templates.some((template) => template.status !== TemplateStatus.Approved);
}

async function recheckNumber(input: {
  admin: NumberAdmin;
  openGraph: (input: { numberId: string }) => Promise<GraphClient>;
  entry: NumberListEntry;
  now: number;
}): Promise<void> {
  const { admin, entry } = input;
  const graph = await input.openGraph({ numberId: entry.numberId });
  const snapshot = await verifyNumber({
    graph,
    phoneNumberId: entry.phoneNumberId,
    wabaId: entry.wabaId,
    displayNumber: entry.displayNumber,
    now: input.now,
  });
  if (snapshot.outcome !== VerificationOutcome.Verified) return;
  await admin.recordVerification({ numberId: entry.numberId, snapshot: JSON.stringify(snapshot), verifiedAt: null });
}

export async function recheckPendingTemplates(input: {
  admin: NumberAdmin;
  openGraph: (input: { numberId: string }) => Promise<GraphClient>;
  now: number;
}): Promise<void> {
  const entries = await input.admin.listNumbers();
  const candidates = entries.filter(
    (entry) =>
      entry.verificationSnapshot !== null &&
      hasUnapprovedTemplate({ snapshot: parseVerificationSnapshot({ text: entry.verificationSnapshot }) }),
  );
  const outcomes = await Promise.allSettled(
    candidates.map((entry) => recheckNumber({ admin: input.admin, openGraph: input.openGraph, entry, now: input.now })),
  );
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failure !== undefined) throw failure.reason;
}

export function recheckTemplates(input: { environment: Bindings; now: number }): Promise<void> {
  const { environment } = input;
  return recheckPendingTemplates({
    admin: numberAdminOf({ bindings: environment }),
    now: input.now,
    openGraph: async ({ numberId }) => {
      const { accessToken } = await numberRegistryOf({ bindings: environment }).openForInbound({ numberId });
      return createGraphClient({
        baseUrl: readWhatsAppEnvironment({ env: environment }).graphBaseUrl,
        accessToken,
        developmentMediaOrigin: null,
        fetcher: fetch,
      });
    },
  });
}

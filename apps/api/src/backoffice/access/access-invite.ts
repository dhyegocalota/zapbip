import { START_PREFILLED_TEXT } from '@zapbip/types';
import { D1AccessInvites } from '../../adapters/d1/d1-access-invites';
import type { Bindings } from '../../contract/env';
import { whatsappLinkTarget } from '../../routes/start-link-target';
import type { BatchCounts } from './access-batch-counts';
import { findWaitlistEntries } from './access-queries';

export type IssuedInvite = { email: string; link: string };

export async function issueInvites(input: {
  bindings: Bindings;
  emails: string[];
  displayNumber: string;
  now: number;
}): Promise<IssuedInvite[]> {
  const { bindings, emails, displayNumber, now } = input;
  const invites = new D1AccessInvites({ database: bindings.CONNECTIONS });
  const entries = await findWaitlistEntries({ database: bindings.CONNECTIONS, emails });
  const issued = await Promise.all(
    entries.map(async (entry) => {
      const code = await invites.issue({ email: entry.email, now });
      if (code === null) return [];
      const link = whatsappLinkTarget({ displayNumber, text: `${START_PREFILLED_TEXT[entry.locale]} ${code}` });
      if (link === null) throw new Error('the invite link has no target');
      return [{ email: entry.email, link }];
    }),
  );
  return issued.flat();
}

export function inviteCountsOf(input: { selected: number; issued: IssuedInvite[] }): BatchCounts {
  return { selected: input.selected, issued: input.issued.length, skipped: input.selected - input.issued.length };
}

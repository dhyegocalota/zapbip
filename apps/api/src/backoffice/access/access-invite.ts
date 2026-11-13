import { OWNER_LOCALE_OF_WEB_LOCALE, START_PREFILLED_TEXT } from '@zapbip/types';
import { D1AccessInvites } from '../../adapters/d1/d1-access-invites';
import type { Bindings } from '../../contract/env';
import { whatsappLinkTarget } from '../../routes/start-link-target';
import { BatchCount, type BatchCounts } from './access-batch-counts';
import { findWaitlistEntries } from './access-queries';

export type IssuedInvite = { email: string; link: string };

export async function issueInvites(input: {
  bindings: Bindings;
  emails: string[];
  displayNumber: string;
  now: number;
}): Promise<IssuedInvite[]> {
  const { bindings, emails, displayNumber, now } = input;
  const entries = await findWaitlistEntries({ database: bindings.CONNECTIONS, emails });
  const codes = await new D1AccessInvites({ database: bindings.CONNECTIONS }).issueMany({
    emails: entries.map((entry) => entry.email),
    now,
  });
  return entries.flatMap((entry, index) => {
    const code = codes[index];
    if (code === undefined || code === null) return [];
    const link = whatsappLinkTarget({ displayNumber, text: `${START_PREFILLED_TEXT[OWNER_LOCALE_OF_WEB_LOCALE[entry.locale]]} ${code}` });
    if (link === null) throw new Error('the invite link has no target');
    return [{ email: entry.email, link }];
  });
}

export function inviteCountsOf(input: { selected: number; issued: IssuedInvite[] }): BatchCounts {
  return {
    [BatchCount.Selected]: input.selected,
    [BatchCount.Issued]: input.issued.length,
    [BatchCount.Skipped]: input.selected - input.issued.length,
  };
}

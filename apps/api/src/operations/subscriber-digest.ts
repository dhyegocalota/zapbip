import { utcDay } from '../account-inbox/usage-meter';
import { type EmailSender, EmailSendOutcome } from '../emails/email-sender';
import { subscriberDigestMessageOf } from '../emails/subscriber-digest-email';
import { SUBSCRIBER_DIGEST_WINDOW_MS } from './constants';
import { readSubscriberDigestFacts } from './subscriber-digest-queries';

export async function runSubscriberDigest(input: { database: D1Database; sender: EmailSender; now: number }): Promise<void> {
  const { database, sender, now } = input;
  const facts = await readSubscriberDigestFacts({ database, since: now - SUBSCRIBER_DIGEST_WINDOW_MS, until: now });
  const outcome = await sender.send(await subscriberDigestMessageOf({ facts, now }));
  if (outcome === EmailSendOutcome.Failed) throw new Error(`subscriber digest failed on ${utcDay({ now })}`);
}

import type { EmailSender } from '../emails/email-sender';

export async function runSubscriberDigest(_input: { database: D1Database; sender: EmailSender; now: number }): Promise<void> {
  throw new Error('runSubscriberDigest is not implemented');
}

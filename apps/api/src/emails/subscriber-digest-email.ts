import type { SubscriberDigestFacts } from '../operations/subscriber-digest-queries';
import type { EmailMessage } from './email-sender';

export async function subscriberDigestMessageOf(_input: { facts: SubscriberDigestFacts; now: number }): Promise<EmailMessage> {
  throw new Error('subscriberDigestMessageOf is not implemented');
}

import type { OwnerLocale } from '@zapbip/types';
import type { EmailMessage } from './email-sender';

export async function welcomeMessageOf(_input: { locale: OwnerLocale; email: string; referralLink: string | null }): Promise<EmailMessage> {
  throw new Error('welcomeMessageOf is not implemented');
}

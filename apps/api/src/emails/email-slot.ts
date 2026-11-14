export enum EmailSlot {
  Email = 'email',
  ReferralLink = 'referralLink',
  Subject = 'subject',
  Total = 'total',
  WelcomesSent = 'welcomesSent',
  WelcomesFailed = 'welcomesFailed',
  NewSubscriberRows = 'newSubscriberRows',
  LocaleRows = 'localeRows',
  ReferrerRows = 'referrerRows',
  Line = 'line',
}

export type EmailSlotValues = Partial<Record<EmailSlot, string>>;

export function slotOf(_slot: EmailSlot): string {
  throw new Error('slotOf is not implemented');
}

export function filledTextOf(_input: { text: string; values: EmailSlotValues }): string {
  throw new Error('filledTextOf is not implemented');
}

export function filledHtmlOf(_input: { html: string; values: EmailSlotValues }): string {
  throw new Error('filledHtmlOf is not implemented');
}

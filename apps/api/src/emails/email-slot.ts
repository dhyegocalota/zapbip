import { escapeHtml } from './escape-html';

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

export function slotOf(slot: EmailSlot): string {
  return `{{${slot}}}`;
}

export function filledTextOf(input: { text: string; values: EmailSlotValues }): string {
  return Object.entries(input.values).reduce((text, [slot, value]) => text.replaceAll(slotOf(slot as EmailSlot), value), input.text);
}

export function filledHtmlOf(input: { html: string; values: EmailSlotValues }): string {
  const escaped = Object.fromEntries(Object.entries(input.values).map(([slot, value]) => [slot, escapeHtml({ text: value })]));
  return filledTextOf({ text: input.html, values: escaped });
}

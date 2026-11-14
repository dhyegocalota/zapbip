import { WaitlistSource } from '@zapbip/types';
import { utcDay } from '../account-inbox/usage-meter';
import type { DigestSubscriber, SubscriberDigestFacts } from '../operations/subscriber-digest-queries';
import { formattingLocaleOf, LOCALE_PROFILES } from '../web-shell/locale-profiles';
import {
  EMAIL_REPLY_TO,
  EMAIL_SENDER,
  OWNER_TIME_ZONE,
  SUBSCRIBER_DIGEST_IDEMPOTENCY_PREFIX,
  SUBSCRIBER_DIGEST_LOCALE,
  SUBSCRIBER_DIGEST_RECIPIENT,
} from './email-constants';
import { EmailKind, type EmailMessage } from './email-sender';
import { EmailSlot, type EmailSlotValues, filledHtmlOf, filledTextOf } from './email-slot';
import { SUBSCRIBER_DIGEST_EMAIL } from './generated/email-templates';
import { renderSubscriberDigestCopy, SubscriberDigestCopyKey } from './subscriber-digest-email-copy';

const TEXT_ROW_SEPARATOR = '\n\n';
const HTML_ROW_SEPARATOR = '';

const DAY_FORMAT = new Intl.DateTimeFormat(formattingLocaleOf({ locale: SUBSCRIBER_DIGEST_LOCALE }), {
  timeZone: OWNER_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
});
const TIME_FORMAT = new Intl.DateTimeFormat(formattingLocaleOf({ locale: SUBSCRIBER_DIGEST_LOCALE }), {
  timeZone: OWNER_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const SOURCE_COPY_KEYS: Record<WaitlistSource, SubscriberDigestCopyKey> = {
  [WaitlistSource.Form]: SubscriberDigestCopyKey.SourceForm,
  [WaitlistSource.Agent]: SubscriberDigestCopyKey.SourceAgent,
};

type RowSlot = EmailSlot.NewSubscriberRows | EmailSlot.LocaleRows | EmailSlot.ReferrerRows;

export type SubscriberDigestInput = { facts: SubscriberDigestFacts; now: number };

function copy(key: SubscriberDigestCopyKey, values?: Record<string, string>): string {
  return renderSubscriberDigestCopy({ key, values });
}

function subjectOf(input: SubscriberDigestInput): string {
  const date = DAY_FORMAT.format(new Date(input.now));
  if (input.facts.newCount === 1) return copy(SubscriberDigestCopyKey.SubjectOne, { date });
  return copy(SubscriberDigestCopyKey.SubjectMany, { count: String(input.facts.newCount), date });
}

function subscriberLineOf(input: { subscriber: DigestSubscriber }): string {
  const { subscriber } = input;
  const values = {
    time: TIME_FORMAT.format(new Date(subscriber.joinedAt)),
    email: subscriber.email,
    language: LOCALE_PROFILES[subscriber.locale].nativeName,
    source: copy(SOURCE_COPY_KEYS[subscriber.source]),
  };
  if (subscriber.referrerEmail === null) return copy(SubscriberDigestCopyKey.SubscriberLine, values);
  return copy(SubscriberDigestCopyKey.ReferredSubscriberLine, { ...values, referrer: subscriber.referrerEmail });
}

function newSubscriberLinesOf(input: { facts: SubscriberDigestFacts }): string[] {
  const { facts } = input;
  if (facts.newSubscribers.length === 0) return [copy(SubscriberDigestCopyKey.NoNewSubscribers)];
  const lines = facts.newSubscribers.map((subscriber) => subscriberLineOf({ subscriber }));
  const hiddenCount = facts.newCount - facts.newSubscribers.length;
  if (hiddenCount <= 0) return lines;
  return [...lines, copy(SubscriberDigestCopyKey.MoreSubscribers, { count: String(hiddenCount) })];
}

function localeLinesOf(input: { facts: SubscriberDigestFacts }): string[] {
  return input.facts.localeTotals.map((entry) =>
    copy(SubscriberDigestCopyKey.LocaleLine, { language: LOCALE_PROFILES[entry.locale].nativeName, total: String(entry.total) }),
  );
}

function referrerLinesOf(input: { facts: SubscriberDigestFacts }): string[] {
  if (input.facts.topReferrers.length === 0) return [copy(SubscriberDigestCopyKey.NoReferrers)];
  return input.facts.topReferrers.map((referrer) =>
    copy(SubscriberDigestCopyKey.ReferrerLine, { email: referrer.email, count: String(referrer.total) }),
  );
}

function rowLinesOf(input: { facts: SubscriberDigestFacts }): Record<RowSlot, string[]> {
  return {
    [EmailSlot.NewSubscriberRows]: newSubscriberLinesOf(input),
    [EmailSlot.LocaleRows]: localeLinesOf(input),
    [EmailSlot.ReferrerRows]: referrerLinesOf(input),
  };
}

function rowsHtmlOf(input: { rows: Record<RowSlot, string[]> }): EmailSlotValues {
  const { row } = SUBSCRIBER_DIGEST_EMAIL;
  return Object.fromEntries(
    Object.entries(input.rows).map(([slot, lines]) => [
      slot,
      lines.map((line) => filledHtmlOf({ html: row.html, values: { [EmailSlot.Line]: line } })).join(HTML_ROW_SEPARATOR),
    ]),
  );
}

function rowsTextOf(input: { rows: Record<RowSlot, string[]> }): EmailSlotValues {
  const { row } = SUBSCRIBER_DIGEST_EMAIL;
  return Object.fromEntries(
    Object.entries(input.rows).map(([slot, lines]) => [
      slot,
      lines.map((line) => filledTextOf({ text: row.text, values: { [EmailSlot.Line]: line } })).join(TEXT_ROW_SEPARATOR),
    ]),
  );
}

export async function subscriberDigestMessageOf(input: SubscriberDigestInput): Promise<EmailMessage> {
  const { facts } = input;
  const { shell } = SUBSCRIBER_DIGEST_EMAIL;
  const subject = subjectOf(input);
  const scalars = {
    [EmailSlot.Subject]: subject,
    [EmailSlot.Total]: String(facts.total),
    [EmailSlot.WelcomesSent]: String(facts.welcomesSent),
    [EmailSlot.WelcomesFailed]: String(facts.welcomesFailed),
  };
  const rows = rowLinesOf({ facts });
  return {
    kind: EmailKind.SubscriberDigest,
    from: EMAIL_SENDER,
    to: SUBSCRIBER_DIGEST_RECIPIENT,
    replyTo: EMAIL_REPLY_TO,
    subject,
    html: filledTextOf({ text: filledHtmlOf({ html: shell.html, values: scalars }), values: rowsHtmlOf({ rows }) }),
    text: filledTextOf({ text: filledTextOf({ text: shell.text, values: scalars }), values: rowsTextOf({ rows }) }),
    idempotencyKey: `${SUBSCRIBER_DIGEST_IDEMPOTENCY_PREFIX}${utcDay({ now: input.now })}`,
  };
}

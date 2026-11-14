import { Heading, Text } from '@react-email/components';
import { OwnerLocale, WaitlistSource } from '@zapbip/types';
import { createElement, type ReactElement } from 'react';
import { utcDay } from '../account-inbox/usage-meter';
import type { DigestSubscriber, SubscriberDigestFacts } from '../operations/subscriber-digest-queries';
import { formattingLocaleOf, LOCALE_PROFILES } from '../web-shell/locale-profiles';
import {
  EMAIL_REPLY_TO,
  EMAIL_SENDER,
  OWNER_TIME_ZONE,
  SUBSCRIBER_DIGEST_IDEMPOTENCY_PREFIX,
  SUBSCRIBER_DIGEST_RECIPIENT,
} from './email-constants';
import { EmailLayout } from './email-layout';
import { EmailKind, type EmailMessage } from './email-sender';
import { HEADING_STYLE, LINE_STYLE, SUBHEADING_STYLE } from './email-style';
import { renderEmail } from './render-email';
import { renderSubscriberDigestCopy, SubscriberDigestCopyKey } from './subscriber-digest-email-copy';

export const SUBSCRIBER_DIGEST_LOCALE = OwnerLocale.PortugueseBrazil;

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

export type SubscriberDigestEmailProps = { facts: SubscriberDigestFacts; now: number };

function copy(key: SubscriberDigestCopyKey, values?: Record<string, string>): string {
  return renderSubscriberDigestCopy({ key, values });
}

function subjectOf(input: SubscriberDigestEmailProps): string {
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

function line(text: string): ReactElement {
  return createElement(Text, { style: LINE_STYLE }, text);
}

function subheading(text: string): ReactElement {
  return createElement(Heading, { as: 'h2', style: SUBHEADING_STYLE }, text);
}

function newSubscriberLinesOf(input: { facts: SubscriberDigestFacts }): ReactElement[] {
  const { facts } = input;
  if (facts.newSubscribers.length === 0) return [line(copy(SubscriberDigestCopyKey.NoNewSubscribers))];
  const lines = facts.newSubscribers.map((subscriber) => line(subscriberLineOf({ subscriber })));
  const hiddenCount = facts.newCount - facts.newSubscribers.length;
  if (hiddenCount <= 0) return lines;
  return [...lines, line(copy(SubscriberDigestCopyKey.MoreSubscribers, { count: String(hiddenCount) }))];
}

function referrerLinesOf(input: { facts: SubscriberDigestFacts }): ReactElement[] {
  if (input.facts.topReferrers.length === 0) return [line(copy(SubscriberDigestCopyKey.NoReferrers))];
  return input.facts.topReferrers.map((referrer) =>
    line(copy(SubscriberDigestCopyKey.ReferrerLine, { email: referrer.email, count: String(referrer.total) })),
  );
}

export function SubscriberDigestEmail(props: SubscriberDigestEmailProps): ReactElement {
  const { facts } = props;
  return createElement(
    EmailLayout,
    {
      locale: SUBSCRIBER_DIGEST_LOCALE,
      title: subjectOf(props),
      preview: copy(SubscriberDigestCopyKey.Preview),
      footer: copy(SubscriberDigestCopyKey.Footer, { recipient: SUBSCRIBER_DIGEST_RECIPIENT }),
    },
    createElement(Heading, { as: 'h1', style: HEADING_STYLE }, copy(SubscriberDigestCopyKey.Heading)),
    subheading(copy(SubscriberDigestCopyKey.NewTitle)),
    ...newSubscriberLinesOf({ facts }),
    subheading(copy(SubscriberDigestCopyKey.TotalsTitle)),
    line(copy(SubscriberDigestCopyKey.TotalLine, { total: String(facts.total) })),
    subheading(copy(SubscriberDigestCopyKey.LocalesTitle)),
    ...facts.localeTotals.map((entry) =>
      line(copy(SubscriberDigestCopyKey.LocaleLine, { language: LOCALE_PROFILES[entry.locale].nativeName, total: String(entry.total) })),
    ),
    subheading(copy(SubscriberDigestCopyKey.WelcomeTitle)),
    line(copy(SubscriberDigestCopyKey.WelcomeSentLine, { count: String(facts.welcomesSent) })),
    line(copy(SubscriberDigestCopyKey.WelcomeFailedLine, { count: String(facts.welcomesFailed) })),
    subheading(copy(SubscriberDigestCopyKey.ReferrersTitle)),
    ...referrerLinesOf({ facts }),
  );
}

export async function subscriberDigestMessageOf(input: SubscriberDigestEmailProps): Promise<EmailMessage> {
  const rendered = await renderEmail({ element: createElement(SubscriberDigestEmail, input) });
  return {
    kind: EmailKind.SubscriberDigest,
    from: EMAIL_SENDER,
    to: SUBSCRIBER_DIGEST_RECIPIENT,
    replyTo: EMAIL_REPLY_TO,
    subject: subjectOf(input),
    ...rendered,
    idempotencyKey: `${SUBSCRIBER_DIGEST_IDEMPOTENCY_PREFIX}${utcDay({ now: input.now })}`,
  };
}

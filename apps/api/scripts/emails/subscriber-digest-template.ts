import { Heading, Text } from '@react-email/components';
import { createElement, type ReactElement } from 'react';
import { SUBSCRIBER_DIGEST_LOCALE, SUBSCRIBER_DIGEST_RECIPIENT } from '../../src/emails/email-constants';
import { EmailSlot, slotOf } from '../../src/emails/email-slot';
import type { GeneratedDigestEmail } from '../../src/emails/generated-email';
import { renderSubscriberDigestCopy, SubscriberDigestCopyKey } from '../../src/emails/subscriber-digest-email-copy';
import { EmailLayout } from './email-layout';
import { HEADING_STYLE, LINE_STYLE, SUBHEADING_STYLE } from './email-style';
import { renderEmail, renderFragment } from './render-email';

function copy(key: SubscriberDigestCopyKey, values?: Record<string, string>): string {
  return renderSubscriberDigestCopy({ key, values });
}

function subheading(text: string): ReactElement {
  return createElement(Heading, { as: 'h2', style: SUBHEADING_STYLE }, text);
}

function line(text: string): ReactElement {
  return createElement(Text, { style: LINE_STYLE }, text);
}

export function SubscriberDigestShell(): ReactElement {
  return createElement(
    EmailLayout,
    {
      locale: SUBSCRIBER_DIGEST_LOCALE,
      title: slotOf(EmailSlot.Subject),
      preview: copy(SubscriberDigestCopyKey.Preview),
      footer: copy(SubscriberDigestCopyKey.Footer, { recipient: SUBSCRIBER_DIGEST_RECIPIENT }),
    },
    createElement(Heading, { as: 'h1', style: HEADING_STYLE }, copy(SubscriberDigestCopyKey.Heading)),
    subheading(copy(SubscriberDigestCopyKey.NewTitle)),
    slotOf(EmailSlot.NewSubscriberRows),
    subheading(copy(SubscriberDigestCopyKey.TotalsTitle)),
    line(copy(SubscriberDigestCopyKey.TotalLine, { total: slotOf(EmailSlot.Total) })),
    subheading(copy(SubscriberDigestCopyKey.LocalesTitle)),
    slotOf(EmailSlot.LocaleRows),
    subheading(copy(SubscriberDigestCopyKey.WelcomeTitle)),
    line(copy(SubscriberDigestCopyKey.WelcomeSentLine, { count: slotOf(EmailSlot.WelcomesSent) })),
    line(copy(SubscriberDigestCopyKey.WelcomeFailedLine, { count: slotOf(EmailSlot.WelcomesFailed) })),
    subheading(copy(SubscriberDigestCopyKey.ReferrersTitle)),
    slotOf(EmailSlot.ReferrerRows),
  );
}

export async function generatedSubscriberDigestEmail(): Promise<GeneratedDigestEmail> {
  const shell = await renderEmail({ element: createElement(SubscriberDigestShell) });
  const row = renderFragment({ element: line(slotOf(EmailSlot.Line)) });
  return { shell, row };
}

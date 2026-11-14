import { Button, Heading, Link, Section, Text } from '@react-email/components';
import { COMPANY, ONBOARDING_SETUP_LINKS, type OwnerLocale } from '@zapbip/types';
import { createElement, type ReactElement } from 'react';
import { sha256Hex } from '../adapters/platform/hash';
import { startLinkOf } from '../site/site-links';
import { EMAIL_REPLY_TO, EMAIL_SENDER, WELCOME_IDEMPOTENCY_PREFIX } from './email-constants';
import { EmailLayout } from './email-layout';
import { EmailKind, type EmailMessage } from './email-sender';
import { ACTION_STYLE, BUTTON_STYLE, HEADING_STYLE, LINK_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';
import { welcomeCopyOf, WelcomeEmailCopyKey } from './welcome-email-copy';

export type WelcomeEmailProps = { locale: OwnerLocale; email: string; referralLink: string | null };

function ReferralBlock(props: { locale: OwnerLocale; referralLink: string | null }): ReactElement | null {
  if (props.referralLink === null) return null;
  const translate = welcomeCopyOf({ locale: props.locale });
  return createElement(
    Section,
    null,
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.ReferralLead)),
    createElement(
      Text,
      { style: PARAGRAPH_STYLE },
      createElement(Link, { href: props.referralLink, style: LINK_STYLE }, props.referralLink),
    ),
  );
}

export function WelcomeEmail(props: WelcomeEmailProps): ReactElement {
  const { locale, email, referralLink } = props;
  const translate = welcomeCopyOf({ locale });
  return createElement(
    EmailLayout,
    {
      locale,
      title: translate(WelcomeEmailCopyKey.Subject),
      preview: translate(WelcomeEmailCopyKey.Preview),
      footer: translate(WelcomeEmailCopyKey.Footer, { email, company: COMPANY.tradeName }),
    },
    createElement(Heading, { as: 'h1', style: HEADING_STYLE }, translate(WelcomeEmailCopyKey.Heading)),
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.Intro)),
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.Waves)),
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.StartLead)),
    createElement(
      Section,
      { style: ACTION_STYLE },
      createElement(Button, { href: startLinkOf({ locale }), style: BUTTON_STYLE }, translate(WelcomeEmailCopyKey.StartAction)),
    ),
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.DocsLead)),
    createElement(
      Text,
      { style: PARAGRAPH_STYLE },
      createElement(Link, { href: ONBOARDING_SETUP_LINKS[locale], style: LINK_STYLE }, translate(WelcomeEmailCopyKey.DocsAction)),
    ),
    createElement(ReferralBlock, { locale, referralLink }),
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.Signoff)),
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.SignoffTeam)),
  );
}

export async function welcomeMessageOf(input: WelcomeEmailProps): Promise<EmailMessage> {
  const rendered = await renderEmail({ element: createElement(WelcomeEmail, input) });
  return {
    kind: EmailKind.Welcome,
    from: EMAIL_SENDER,
    to: input.email,
    replyTo: EMAIL_REPLY_TO,
    subject: welcomeCopyOf({ locale: input.locale })(WelcomeEmailCopyKey.Subject),
    ...rendered,
    idempotencyKey: `${WELCOME_IDEMPOTENCY_PREFIX}${await sha256Hex({ value: input.email })}`,
  };
}

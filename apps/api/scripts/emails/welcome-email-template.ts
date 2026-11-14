import { Button, Heading, Link, Section, Text } from '@react-email/components';
import { COMPANY, ONBOARDING_SETUP_LINKS, type OwnerLocale } from '@zapbip/types';
import { createElement, type ReactElement } from 'react';
import { EmailSlot, slotOf } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { welcomeCopyOf, WelcomeEmailCopyKey } from '../../src/emails/welcome-email-copy';
import { startLinkOf } from '../../src/site/site-links';
import { EmailLayout } from './email-layout';
import { ACTION_STYLE, BUTTON_STYLE, HEADING_STYLE, LINK_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';

export type WelcomeEmailTemplateProps = { locale: OwnerLocale; isReferralOpen: boolean };

function ReferralBlock(props: WelcomeEmailTemplateProps): ReactElement | null {
  if (!props.isReferralOpen) return null;
  const translate = welcomeCopyOf({ locale: props.locale });
  const referralLink = slotOf(EmailSlot.ReferralLink);
  return createElement(
    Section,
    null,
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.ReferralLead)),
    createElement(Text, { style: PARAGRAPH_STYLE }, createElement(Link, { href: referralLink, style: LINK_STYLE }, referralLink)),
  );
}

export function WelcomeEmailTemplate(props: WelcomeEmailTemplateProps): ReactElement {
  const { locale } = props;
  const translate = welcomeCopyOf({ locale });
  return createElement(
    EmailLayout,
    {
      locale,
      title: translate(WelcomeEmailCopyKey.Subject),
      preview: translate(WelcomeEmailCopyKey.Preview),
      footer: translate(WelcomeEmailCopyKey.Footer, { email: slotOf(EmailSlot.Email), company: COMPANY.tradeName }),
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
    createElement(ReferralBlock, props),
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.Signoff)),
    createElement(Text, { style: PARAGRAPH_STYLE }, translate(WelcomeEmailCopyKey.SignoffTeam)),
  );
}

export async function generatedWelcomeEmailOf(input: WelcomeEmailTemplateProps): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(WelcomeEmailTemplate, input) });
  return { subject: welcomeCopyOf({ locale: input.locale })(WelcomeEmailCopyKey.Subject), ...rendered };
}

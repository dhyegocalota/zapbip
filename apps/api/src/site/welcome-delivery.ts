import type { OwnerLocale } from '@zapbip/types';
import type { Context } from 'hono';
import { LogEvent } from '../contract/log';
import { EmailKind, type EmailSender, EmailSendOutcome } from '../emails/email-sender';
import { welcomeMessageOf } from '../emails/welcome-email';
import { logEvent } from '../log';
import type { SiteEnv } from './site-env';
import { pagePathOf } from './site-links';

const CLAIM_STATEMENT = 'UPDATE landing_waitlist SET welcome_sent_at = ?1 WHERE email = ?2 AND welcome_sent_at IS NULL';
const FAILURE_STATEMENT = 'UPDATE landing_waitlist SET welcome_sent_at = NULL, welcome_failed_at = ?1 WHERE email = ?2';
const RELEASE_STATEMENT = 'UPDATE landing_waitlist SET welcome_sent_at = NULL WHERE email = ?1';
const WELCOME_ERROR_CODE = 'WelcomeError';

type WelcomeDelivery = {
  database: D1Database;
  sender: EmailSender;
  email: string;
  locale: OwnerLocale;
  referralLink: string;
  now: number;
};

const OUTCOME_STATEMENTS: Record<EmailSendOutcome, (input: WelcomeDelivery) => D1PreparedStatement | null> = {
  [EmailSendOutcome.Sent]: () => null,
  [EmailSendOutcome.Failed]: ({ database, email, now }) => database.prepare(FAILURE_STATEMENT).bind(now, email),
  [EmailSendOutcome.Disabled]: ({ database, email }) => database.prepare(RELEASE_STATEMENT).bind(email),
};

function failureOf(input: { error: unknown }): EmailSendOutcome {
  logEvent({
    event: LogEvent.EmailSendFailed,
    kind: EmailKind.Welcome,
    errorCode: input.error instanceof Error ? input.error.name : WELCOME_ERROR_CODE,
  });
  return EmailSendOutcome.Failed;
}

async function deliverWelcome(input: WelcomeDelivery): Promise<void> {
  const message = await welcomeMessageOf({ locale: input.locale, email: input.email, referralLink: input.referralLink });
  const claim = await input.database.prepare(CLAIM_STATEMENT).bind(input.now, input.email).run();
  if (claim.meta.changes === 0) return;
  const outcome = await input.sender.send(message).catch((error: unknown) => failureOf({ error }));
  const statement = OUTCOME_STATEMENTS[outcome](input);
  if (statement === null) return;
  await statement.run();
}

async function sendWelcomeEmail(input: WelcomeDelivery): Promise<void> {
  await deliverWelcome(input).catch((error: unknown) => failureOf({ error }));
}

function welcomeReferralLinkOf(input: { siteOrigin: string; locale: OwnerLocale; referralCode: string }): string {
  return `${input.siteOrigin}${pagePathOf({ locale: input.locale, agent: null, referralCode: input.referralCode })}`;
}

export function scheduleWelcomeEmail(input: { context: Context<SiteEnv>; email: string; locale: OwnerLocale; referralCode: string }): void {
  const { context, email, locale, referralCode } = input;
  const welcome = sendWelcomeEmail({
    database: context.env.CONNECTIONS,
    sender: context.get('emailSender'),
    email,
    locale,
    referralLink: welcomeReferralLinkOf({ siteOrigin: context.env.SITE_ORIGIN, locale, referralCode }),
    now: Date.now(),
  });
  context.executionCtx.waitUntil(welcome);
}

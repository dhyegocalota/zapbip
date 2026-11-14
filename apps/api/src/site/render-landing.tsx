import { HttpStatus } from '@zapbip/types';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { LegalDocument } from './legal-links';
import { JoinState, type JoinView, type PageModel } from './page-model';
import { isWaitlistOpen } from './site-configuration';
import type { SiteEnv } from './site-env';
import { LandingPage } from './views/landing-page';
import { LegalPage } from './views/legal-page';
import { NotFoundPage } from './views/not-found-page';

export function pageModelOf(input: { context: Context<SiteEnv>; join: JoinView; starCount: number | null }): PageModel {
  const { context, join, starCount } = input;
  return {
    locale: context.get('locale'),
    theme: context.get('theme'),
    siteOrigin: new URL(context.env.SITE_ORIGIN).origin,
    turnstileSiteKey: context.env.TURNSTILE_SITE_KEY,
    referralCode: context.get('referralCode'),
    agent: context.get('agent'),
    agentParameter: context.get('agentParameter'),
    startTab: context.get('startTab'),
    join,
    legalDocument: null,
    starCount,
  };
}

export function idleJoinOf(input: { context: Context<SiteEnv> }): JoinView {
  return isWaitlistOpen({ env: input.context.env }) ? { state: JoinState.Idle, emailValue: '' } : { state: JoinState.Paused };
}

export function renderLanding(input: {
  context: Context<SiteEnv>;
  join: JoinView;
  status: HttpStatus;
  headers: Record<string, string>;
  starCount: number | null;
}): Response | Promise<Response> {
  const { context, join, status, headers, starCount } = input;
  return context.html(<LandingPage model={pageModelOf({ context, join, starCount })} />, status as ContentfulStatusCode, headers);
}

export function renderNotFound(input: {
  context: Context<SiteEnv>;
  status: HttpStatus;
  starCount: number | null;
}): Response | Promise<Response> {
  const { context, status, starCount } = input;
  return context.html(
    <NotFoundPage model={pageModelOf({ context, join: idleJoinOf({ context }), starCount })} />,
    status as ContentfulStatusCode,
  );
}

export function renderLegal(input: {
  context: Context<SiteEnv>;
  document: LegalDocument;
  headers: Record<string, string>;
  starCount: number | null;
}): Response | Promise<Response> {
  const { context, document, headers, starCount } = input;
  const model = { ...pageModelOf({ context, join: idleJoinOf({ context }), starCount }), legalDocument: document };
  return context.html(<LegalPage model={model} document={document} />, HttpStatus.Ok, headers);
}

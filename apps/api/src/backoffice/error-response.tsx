import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { DeployEnvironment } from '../contract/deploy-environment';
import { ACCEPT_LANGUAGE_HEADER, LOCALE_COOKIE_NAME, THEME_COOKIE_NAME } from './backoffice-constants';
import type { BackofficeEnv } from './backoffice-env';
import { resolveTheme } from '../web-shell/shell-theme';
import { resolveLocale } from './locale';
import { ErrorPage, type ErrorStatus } from './views/error-page';

const DEPLOY_ENVIRONMENTS: string[] = Object.values(DeployEnvironment);

function environmentOf(input: { value: string }): DeployEnvironment | null {
  return DEPLOY_ENVIRONMENTS.includes(input.value) ? (input.value as DeployEnvironment) : null;
}

export function errorResponse(input: {
  context: Context<BackofficeEnv>;
  status: ErrorStatus;
  headers?: Record<string, string>;
}): Response | Promise<Response> {
  const { context, status, headers } = input;
  const locale = resolveLocale({
    cookieValue: getCookie(context, LOCALE_COOKIE_NAME),
    acceptLanguage: context.req.header(ACCEPT_LANGUAGE_HEADER),
  });
  const theme = resolveTheme({ cookieValue: getCookie(context, THEME_COOKIE_NAME) });
  const page = <ErrorPage status={status} locale={locale} theme={theme} environment={environmentOf({ value: context.env.ENVIRONMENT })} />;
  return context.html(page, status as ContentfulStatusCode, headers);
}

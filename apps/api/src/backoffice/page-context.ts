import type { WebLocale } from '@zapbip/types';
import type { Context } from 'hono';
import { parseDeployEnvironment } from '../operations/deploy-environment';
import type { DeployEnvironment } from '../contract/deploy-environment';
import { STYLESHEET_HREF } from './assets/stylesheet';
import { csrfTokenOf } from './auth/csrf';
import type { BackofficeEnv } from './backoffice-env';
import { type BackofficeNotice, noticeOf } from './backoffice-notice';
import type { ShellTheme } from '../web-shell/shell-theme';
import { BackofficePath } from './backoffice-paths';

const NOTICE_QUERY = 'notice';

export type PageContext = {
  locale: WebLocale;
  theme: ShellTheme;
  environment: DeployEnvironment;
  stylesheetHref: string;
  csrfToken: string;
  notice: BackofficeNotice | null;
  returnPath: string;
};

export async function signedInPageContext(input: { context: Context<BackofficeEnv> }): Promise<PageContext> {
  const { context } = input;
  const session = context.get('session');
  if (session === null) throw new Error('a signed-in page was rendered without a session');
  return {
    locale: context.get('locale'),
    theme: context.get('theme'),
    environment: parseDeployEnvironment({ value: context.env.ENVIRONMENT }),
    stylesheetHref: STYLESHEET_HREF,
    csrfToken: await csrfTokenOf({ sessionToken: session.token }),
    notice: noticeOf({ value: context.req.query(NOTICE_QUERY) }),
    returnPath: new URL(context.req.url).pathname,
  };
}

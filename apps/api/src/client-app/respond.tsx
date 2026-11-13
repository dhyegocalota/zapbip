import { HttpStatus } from '@zapbip/types';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ClientAppCopyKey } from './client-app-copy';
import type { ClientAppEnv } from './client-app-env';
import { ClientAppPath } from './client-app-paths';
import { MessagePage } from './views/message-page';

export function respondMessage(input: {
  context: Context<ClientAppEnv>;
  status: HttpStatus;
  title: ClientAppCopyKey;
  body: ClientAppCopyKey;
  headers?: Record<string, string>;
}): Response | Promise<Response> {
  const { context, status, title, body, headers } = input;
  const session = context.get('session');
  const page = (
    <MessagePage
      locale={context.get('locale')}
      title={title}
      body={body}
      currentPath={ClientAppPath.Home}
      csrfToken={session === null ? null : session.csrfToken}
    />
  );
  return context.html(page, status as ContentfulStatusCode, headers);
}

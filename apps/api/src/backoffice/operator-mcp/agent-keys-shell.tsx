import type { Child } from 'hono/jsx';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';
import { Layout } from '../layout';
import type { PageContext } from '../page-context';

export function AgentKeysShell(props: { page: PageContext; title: BackofficeCopyKey; children?: Child }) {
  const { page, title, children } = props;
  const heading = renderBackofficeCopy({ key: title, locale: page.locale });
  return (
    <Layout
      locale={page.locale}
      environment={page.environment}
      title={heading}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.AgentKeys}
      notice={page.notice}
      theme={page.theme}
      returnPath={page.returnPath}
    >
      <div class="page-head">
        <h1>{heading}</h1>
      </div>
      {children}
    </Layout>
  );
}

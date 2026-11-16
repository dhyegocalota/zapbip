import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';
import { NoticeVariant } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { Notice } from '../../components/notice';
import { Layout } from '../../layout';
import type { PageContext } from '../../page-context';

export function ConnectOwnBusinessUnavailablePage(props: { page: PageContext }) {
  const { page } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.ConnectOwnTitle)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Numbers}
      notice={page.notice}
      theme={page.theme}
      returnPath={page.returnPath}
    >
      <section class="card form-card" aria-labelledby="connect-own-title">
        <h1 id="connect-own-title">{translate(BackofficeCopyKey.ConnectOwnTitle)}</h1>
        <Notice variant={NoticeVariant.Warning} locale={locale} message={translate(BackofficeCopyKey.ConnectOwnNotConfigured)} />
        <div class="form-actions">
          <a href={BackofficePath.Numbers} class="button button-secondary">
            {translate(BackofficeCopyKey.ConnectCancel)}
          </a>
        </div>
      </section>
    </Layout>
  );
}

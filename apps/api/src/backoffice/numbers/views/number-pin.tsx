import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';
import { BackofficePath } from '../../backoffice-paths';
import { Layout } from '../../layout';
import type { PageContext } from '../../page-context';
import { numberPath } from '../number-paths';

export type NumberPinPageProps = {
  page: PageContext;
  numberId: string;
  label: string;
  pin: string;
};

export function NumberPinPage(props: NumberPinPageProps) {
  const { page, numberId, label, pin } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={label}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Numbers}
      notice={null}
      theme={page.theme}
      returnPath={page.returnPath}
    >
      <a href={numberPath({ numberId })} class="crumb">
        {translate(BackofficeCopyKey.NumberBack)}
      </a>
      <section class="card form-card" aria-labelledby="pin-title">
        <h1 id="pin-title">{translate(BackofficeCopyKey.NumberPinTitle)}</h1>
        <p class="mono">{pin}</p>
        <p>{translate(BackofficeCopyKey.NumberPinShownOnce)}</p>
      </section>
    </Layout>
  );
}

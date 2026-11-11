import { HttpStatus, type OwnerLocale } from '@zapbip/types';
import type { DeployEnvironment } from '../../contract/deploy-environment';
import { STYLESHEET_HREF } from '../assets/stylesheet';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import type { BackofficeTheme } from '../backoffice-theme';
import { BackofficePath } from '../backoffice-paths';
import { Layout } from '../layout';

export type ErrorStatus =
  | HttpStatus.Unauthorized
  | HttpStatus.Forbidden
  | HttpStatus.NotFound
  | HttpStatus.TooManyRequests
  | HttpStatus.InternalServerError
  | HttpStatus.ServiceUnavailable;

type ErrorView = { title: BackofficeCopyKey; body: BackofficeCopyKey; action: { label: BackofficeCopyKey; path: BackofficePath } | null };

const HOME_ACTION = { label: BackofficeCopyKey.ErrorHomeAction, path: BackofficePath.Home };

const ERROR_VIEWS: Record<ErrorStatus, ErrorView> = {
  [HttpStatus.Unauthorized]: {
    title: BackofficeCopyKey.Error401Title,
    body: BackofficeCopyKey.Error401Body,
    action: { label: BackofficeCopyKey.ErrorSignInAction, path: BackofficePath.SignIn },
  },
  [HttpStatus.Forbidden]: { title: BackofficeCopyKey.Error403Title, body: BackofficeCopyKey.Error403Body, action: HOME_ACTION },
  [HttpStatus.NotFound]: { title: BackofficeCopyKey.Error404Title, body: BackofficeCopyKey.Error404Body, action: HOME_ACTION },
  [HttpStatus.TooManyRequests]: {
    title: BackofficeCopyKey.Error429Title,
    body: BackofficeCopyKey.Error429Body,
    action: { label: BackofficeCopyKey.ErrorBackToSignIn, path: BackofficePath.SignIn },
  },
  [HttpStatus.InternalServerError]: { title: BackofficeCopyKey.Error500Title, body: BackofficeCopyKey.Error500Body, action: HOME_ACTION },
  [HttpStatus.ServiceUnavailable]: { title: BackofficeCopyKey.Error503Title, body: BackofficeCopyKey.Error503Body, action: null },
};

export function ErrorPage(props: {
  status: ErrorStatus;
  locale: OwnerLocale;
  environment: DeployEnvironment | null;
  theme?: BackofficeTheme;
}) {
  const { status, locale } = props;
  const view = ERROR_VIEWS[status];
  const title = renderBackofficeCopy({ key: view.title, locale });
  const heading = `${status} ${title}`;
  const code = String(status);
  return (
    <Layout
      locale={locale}
      environment={props.environment}
      title={heading}
      stylesheetHref={STYLESHEET_HREF}
      csrfToken={null}
      signedIn={false}
      currentPath={BackofficePath.Home}
      notice={null}
    >
      <section class="card form-card" aria-labelledby="error-title">
        <h1 id="error-title">
          <span class="error-code">{code}</span> <span class="error-title">{title}</span>
        </h1>
        <p>{renderBackofficeCopy({ key: view.body, locale })}</p>
        {view.action === null ? null : (
          <a href={view.action.path} class="button button-primary">
            {renderBackofficeCopy({ key: view.action.label, locale })}
          </a>
        )}
      </section>
    </Layout>
  );
}

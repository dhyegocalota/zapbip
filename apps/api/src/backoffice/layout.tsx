import type { OwnerLocale } from '@zapbip/types';
import type { Child } from 'hono/jsx';
import { DeployEnvironment } from '../contract/deploy-environment';
import { FAVICON_CONTENT_TYPE, FAVICON_HREF } from './assets/favicon';
import { BackofficeCopyKey, renderBackofficeCopy } from './backoffice-copy';
import { languageOf, textDirectionOf } from '../web-shell/locale-profiles';
import { ShellControls } from '../web-shell/shell-controls';
import { RETURN_TO_FIELD } from '../web-shell/shell-fields';
import { ShellFooter } from '../web-shell/shell-footer';
import type { ShellTheme } from '../web-shell/shell-theme';
import { type BackofficeNotice, NOTICE_VIEWS } from './backoffice-notice';
import { LiveDot } from './components/live-dot';
import { CSRF_FIELD } from './backoffice-constants';
import { BackofficePath } from './backoffice-paths';
import { Notice } from './components/notice';
import { PrimaryNavigation } from './components/primary-navigation';
import { SignOutButton } from './components/sign-out-button';

export type LayoutProps = {
  locale: OwnerLocale;
  environment: DeployEnvironment | null;
  title: string;
  stylesheetHref: string;
  csrfToken: string | null;
  signedIn: boolean;
  currentPath: string;
  returnPath: string;
  notice: BackofficeNotice | null;
  theme: ShellTheme;
  children?: Child;
};

const ENVIRONMENT_BADGES: Record<DeployEnvironment, BackofficeCopyKey | null> = {
  [DeployEnvironment.Production]: null,
  [DeployEnvironment.Staging]: BackofficeCopyKey.EnvironmentStaging,
  [DeployEnvironment.Development]: BackofficeCopyKey.EnvironmentDevelopment,
};
const TITLE_SEPARATOR = ' · ';
const SIGNED_OUT_SHELL_CLASS = 'shell-signed-out';

export function Layout(props: LayoutProps) {
  const { locale, theme, environment, csrfToken, signedIn, notice } = props;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const badgeKey = environment === null ? null : ENVIRONMENT_BADGES[environment];
  const footerKey = environment === null ? BackofficeCopyKey.BrandName : BackofficeCopyKey.FooterLine;
  const documentTitle = `${props.title}${TITLE_SEPARATOR}${translate(BackofficeCopyKey.BrandName)}`;
  const noticeView = notice === null ? null : NOTICE_VIEWS[notice];
  return (
    <html lang={languageOf({ locale })} dir={textDirectionOf({ locale })} data-theme={theme}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{documentTitle}</title>
        <link rel="icon" href={FAVICON_HREF} type={FAVICON_CONTENT_TYPE} />
        <link rel="stylesheet" href={props.stylesheetHref} />
      </head>
      <body class={signedIn ? undefined : SIGNED_OUT_SHELL_CLASS}>
        <a href="#content" class="skip-link">
          {translate(BackofficeCopyKey.SkipToContent)}
        </a>
        <header class="site-header">
          <span class="brand">{translate(BackofficeCopyKey.BrandName)}</span>
          {badgeKey === null ? null : (
            <span class="environment-badge">
              <LiveDot />
              {translate(badgeKey)}
            </span>
          )}
          {signedIn ? <PrimaryNavigation locale={locale} currentPath={props.currentPath} /> : null}
          {csrfToken === null || !signedIn ? null : (
            <div class="header-end">
              <SignOutButton locale={locale} csrfToken={csrfToken} />
            </div>
          )}
        </header>
        <main id="content">
          {noticeView === null ? null : <Notice variant={noticeView.variant} locale={locale} message={translate(noticeView.copyKey)} />}
          {props.children}
        </main>
        <ShellFooter
          locale={locale}
          note={translate(footerKey, { environment: String(environment) })}
          controls={
            csrfToken === null ? null : (
              <ShellControls
                locale={locale}
                theme={theme}
                localeAction={BackofficePath.Locale}
                themeAction={BackofficePath.Theme}
                hiddenFields={[
                  { name: CSRF_FIELD, value: csrfToken },
                  { name: RETURN_TO_FIELD, value: props.returnPath },
                ]}
              />
            )
          }
        />
      </body>
    </html>
  );
}

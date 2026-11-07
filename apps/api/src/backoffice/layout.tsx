import { OwnerLocale } from '@zapbip/types';
import type { Child } from 'hono/jsx';
import { DeployEnvironment } from '../contract/deploy-environment';
import { BackofficeCopyKey, renderBackofficeCopy } from './backoffice-copy';
import { type BackofficeNotice, NOTICE_VIEWS } from './backoffice-notice';
import { LocaleSwitch } from './components/locale-switch';
import { Notice } from './components/notice';
import { PrimaryNavigation } from './components/primary-navigation';
import { SignOutButton } from './components/sign-out-button';

export type LayoutProps = {
  locale: OwnerLocale;
  environment: DeployEnvironment;
  title: string;
  stylesheetHref: string;
  csrfToken: string | null;
  signedIn: boolean;
  currentPath: string;
  notice: BackofficeNotice | null;
  children?: Child;
};

const LANGUAGE_TAGS: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'pt-BR',
  [OwnerLocale.EnglishUs]: 'en',
};
const ENVIRONMENT_BADGES: Record<DeployEnvironment, BackofficeCopyKey | null> = {
  [DeployEnvironment.Production]: null,
  [DeployEnvironment.Staging]: BackofficeCopyKey.EnvironmentStaging,
  [DeployEnvironment.Development]: BackofficeCopyKey.EnvironmentDevelopment,
};
const TITLE_SEPARATOR = ' · ';

export function Layout(props: LayoutProps) {
  const { locale, environment, csrfToken, signedIn, notice } = props;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const badgeKey = ENVIRONMENT_BADGES[environment];
  const documentTitle = `${props.title}${TITLE_SEPARATOR}${translate(BackofficeCopyKey.BrandName)}`;
  const noticeView = notice === null ? null : NOTICE_VIEWS[notice];
  return (
    <html lang={LANGUAGE_TAGS[locale]}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{documentTitle}</title>
        <link rel="stylesheet" href={props.stylesheetHref} />
      </head>
      <body>
        <a href="#content" class="skip-link">
          {translate(BackofficeCopyKey.SkipToContent)}
        </a>
        <header class="site-header">
          <span class="brand">{translate(BackofficeCopyKey.BrandName)}</span>
          {badgeKey === null ? null : <span class="environment-badge">{translate(badgeKey)}</span>}
          {signedIn ? <PrimaryNavigation locale={locale} currentPath={props.currentPath} /> : null}
          {csrfToken === null ? null : <LocaleSwitch locale={locale} csrfToken={csrfToken} returnTo={props.currentPath} />}
          {signedIn && csrfToken !== null ? <SignOutButton locale={locale} csrfToken={csrfToken} /> : null}
        </header>
        <main id="content">
          {noticeView === null ? null : <Notice variant={noticeView.variant} locale={locale} message={translate(noticeView.copyKey)} />}
          {props.children}
        </main>
        <footer class="site-footer">{translate(BackofficeCopyKey.FooterLine, { environment })}</footer>
      </body>
    </html>
  );
}

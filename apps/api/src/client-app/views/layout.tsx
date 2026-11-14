import type { OwnerLocale } from '@zapbip/types';
import type { Child } from 'hono/jsx';
import { FAVICON_CONTENT_TYPE } from '../../backoffice/assets/favicon';
import { BRAND_SEPARATOR, CSRF_FIELD, THEME_COLOR_DARK, THEME_COLOR_LIGHT, WIDE_BODY_CLASS } from '../client-app-constants';
import { ClientAppCopyKey, copyOf } from '../client-app-copy';
import { ClientAppPath, pathWithLocale } from '../client-app-paths';
import { CLIENT_APP_STYLESHEET_HREF } from '../client-app-stylesheet';
import { languageOf, textDirectionOf } from '../../web-shell/locale-profiles';
import { ShellControls } from '../../web-shell/shell-controls';
import { RETURN_TO_FIELD } from '../../web-shell/shell-fields';
import { ShellFooter } from '../../web-shell/shell-footer';
import type { ShellTheme } from '../../web-shell/shell-theme';

export type LayoutProps = {
  locale: OwnerLocale;
  theme: ShellTheme;
  title: string;
  currentPath: string;
  csrfToken: string | null;
  isWide?: boolean;
  children?: Child;
};

function SignOutForm(props: { locale: OwnerLocale; csrfToken: string }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <form method="post" action={pathWithLocale({ locale: props.locale, path: ClientAppPath.SignOut })}>
      <input type="hidden" name={CSRF_FIELD} value={props.csrfToken} />
      <button type="submit" class="button button-secondary">
        {translate(ClientAppCopyKey.SignOut)}
      </button>
    </form>
  );
}

export function Layout(props: LayoutProps) {
  const { locale, csrfToken } = props;
  const translate = copyOf({ locale });
  return (
    <html lang={languageOf({ locale })} dir={textDirectionOf({ locale })} data-theme={props.theme}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content={THEME_COLOR_LIGHT} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={THEME_COLOR_DARK} media="(prefers-color-scheme: dark)" />
        <title>{`${props.title}${BRAND_SEPARATOR}${translate(ClientAppCopyKey.BrandName)}`}</title>
        <link rel="icon" href={ClientAppPath.Favicon} type={FAVICON_CONTENT_TYPE} />
        <link rel="stylesheet" href={CLIENT_APP_STYLESHEET_HREF} />
      </head>
      <body class={props.isWide ? WIDE_BODY_CLASS : undefined}>
        <a href="#content" class="skip-link">
          {translate(ClientAppCopyKey.SkipToContent)}
        </a>
        <header class="app-header">
          <div class="container">
            <a
              class="brand"
              href={pathWithLocale({ locale, path: ClientAppPath.Home })}
              aria-label={translate(ClientAppCopyKey.BrandHomeLabel)}
            >
              {translate(ClientAppCopyKey.BrandName)}
            </a>
            <div class="header-end">{csrfToken === null ? null : <SignOutForm locale={locale} csrfToken={csrfToken} />}</div>
          </div>
        </header>
        <main id="content" class="container">
          {props.children}
        </main>
        <ShellFooter
          locale={locale}
          note={translate(ClientAppCopyKey.FooterMaker)}
          controls={
            <ShellControls
              locale={locale}
              theme={props.theme}
              localeAction={pathWithLocale({ locale, path: ClientAppPath.Locale })}
              themeAction={pathWithLocale({ locale, path: ClientAppPath.Theme })}
              hiddenFields={[{ name: RETURN_TO_FIELD, value: props.currentPath }]}
            />
          }
        />
      </body>
    </html>
  );
}

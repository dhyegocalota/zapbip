import { OwnerLocale } from '@zapbip/types';
import type { Child } from 'hono/jsx';
import { FAVICON_CONTENT_TYPE } from '../../backoffice/assets/favicon';
import { BRAND_SEPARATOR, CSRF_FIELD, THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '../client-app-constants';
import { ClientAppCopyKey, copyOf } from '../client-app-copy';
import { ClientAppPath, pathWithLocale } from '../client-app-paths';
import { CLIENT_APP_STYLESHEET_HREF } from '../client-app-stylesheet';

export type LayoutProps = {
  locale: OwnerLocale;
  title: string;
  currentPath: string;
  csrfToken: string | null;
  children?: Child;
};

const LANGUAGE_TAGS: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'pt-BR',
  [OwnerLocale.EnglishUs]: 'en',
};
const LOCALE_OPTIONS: { locale: OwnerLocale; label: ClientAppCopyKey }[] = [
  { locale: OwnerLocale.EnglishUs, label: ClientAppCopyKey.LocaleEnglish },
  { locale: OwnerLocale.PortugueseBrazil, label: ClientAppCopyKey.LocalePortuguese },
];

function LocaleSwitch(props: { locale: OwnerLocale; currentPath: string }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <nav class="switch" aria-label={translate(ClientAppCopyKey.LocaleLabel)}>
      {LOCALE_OPTIONS.map((option) => (
        <a
          href={pathWithLocale({ locale: option.locale, path: props.currentPath })}
          lang={LANGUAGE_TAGS[option.locale]}
          hreflang={LANGUAGE_TAGS[option.locale]}
          aria-current={option.locale === props.locale ? 'true' : undefined}
        >
          {translate(option.label)}
        </a>
      ))}
    </nav>
  );
}

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
    <html lang={LANGUAGE_TAGS[locale]}>
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
      <body>
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
            <div class="header-end">
              <LocaleSwitch locale={locale} currentPath={props.currentPath} />
              {csrfToken === null ? null : <SignOutForm locale={locale} csrfToken={csrfToken} />}
            </div>
          </div>
        </header>
        <main id="content" class="container">
          {props.children}
        </main>
        <footer class="app-footer">
          <div class="container">{translate(ClientAppCopyKey.FooterMaker)}</div>
        </footer>
      </body>
    </html>
  );
}

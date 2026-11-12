import { DocsLanguage, OwnerLocale } from '@zapbip/types';
import type { Child } from 'hono/jsx';
import { FAVICON_CONTENT_TYPE } from '../../backoffice/assets/favicon';
import { BackofficeTheme } from '../../backoffice/backoffice-theme';
import { type PageModel, JoinState } from '../page-model';
import {
  OPEN_GRAPH_HEIGHT,
  OPEN_GRAPH_WIDTH,
  POSTER_SIZES,
  POSTER_SMALL_WIDTH,
  DEMO_IMAGE_SIZE,
  SITE_BRAND_SEPARATOR,
  SITE_LANGUAGE_PARAMETER,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  TURNSTILE_SCRIPT_URL,
  DOCS_PORTUGUESE_PATH,
} from '../site-constants';
import { leadingAgentNamesOf } from '../site-agents';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { SITE_SCRIPT_HREF } from '../site-scripts';
import { DOCS_ORIGIN, SiteAsset, SitePath } from '../site-paths';
import { SITE_STYLESHEET_HREF } from '../site-stylesheet';

const LANGUAGE_TAGS: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'pt-BR',
  [OwnerLocale.EnglishUs]: 'en',
};
const OPEN_GRAPH_LOCALES: Record<OwnerLocale, OwnerLocale> = {
  [OwnerLocale.PortugueseBrazil]: OwnerLocale.EnglishUs,
  [OwnerLocale.EnglishUs]: OwnerLocale.PortugueseBrazil,
};
const TURNSTILE_LANGUAGES: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'pt-br',
  [OwnerLocale.EnglishUs]: 'en',
};
const LOCALE_OPTIONS: { locale: OwnerLocale; short: SiteCopyKey; full: SiteCopyKey }[] = [
  { locale: OwnerLocale.PortugueseBrazil, short: SiteCopyKey.LocalePortugueseShort, full: SiteCopyKey.LocalePortuguese },
  { locale: OwnerLocale.EnglishUs, short: SiteCopyKey.LocaleEnglishShort, full: SiteCopyKey.LocaleEnglish },
];
const THEME_OPTIONS: { theme: BackofficeTheme; label: SiteCopyKey }[] = [
  { theme: BackofficeTheme.Light, label: SiteCopyKey.ThemeLight },
  { theme: BackofficeTheme.Dark, label: SiteCopyKey.ThemeDark },
  { theme: BackofficeTheme.System, label: SiteCopyKey.ThemeSystem },
];
const HOME_FRAGMENT = '#join';
const FORM_FRAGMENT = '#join-email';

export function turnstileLanguageOf(input: { locale: OwnerLocale }): string {
  return TURNSTILE_LANGUAGES[input.locale];
}

export function returnPathOf(input: { referralCode: string | null }): string {
  return input.referralCode === null ? SitePath.Home : `${SitePath.Home}?ref=${input.referralCode}`;
}

function LocaleSwitch(props: { model: PageModel }) {
  const translate = copyOf({ locale: props.model.locale });
  return (
    <form method="post" action={SitePath.Locale} class="switch" aria-label={translate(SiteCopyKey.LocaleLabel)}>
      <input type="hidden" name="returnTo" value={returnPathOf({ referralCode: props.model.referralCode })} />
      {LOCALE_OPTIONS.map((option) => (
        <button
          type="submit"
          name="locale"
          value={option.locale}
          lang={LANGUAGE_TAGS[option.locale]}
          aria-label={translate(option.full)}
          aria-pressed={String(option.locale === props.model.locale)}
        >
          <span class="label-short">{translate(option.short)}</span>
          <span class="label-full">{translate(option.full)}</span>
        </button>
      ))}
    </form>
  );
}

function ThemeSwitch(props: { model: PageModel }) {
  const translate = copyOf({ locale: props.model.locale });
  return (
    <form method="post" action={SitePath.Theme} class="switch" aria-label={translate(SiteCopyKey.ThemeLabel)}>
      <input type="hidden" name="returnTo" value={returnPathOf({ referralCode: props.model.referralCode })} />
      {THEME_OPTIONS.map((option) => (
        <button type="submit" name="theme" value={option.theme} aria-pressed={String(option.theme === props.model.theme)}>
          {translate(option.label)}
        </button>
      ))}
    </form>
  );
}

function docsHrefOf(input: { locale: OwnerLocale }): string {
  return input.locale === OwnerLocale.PortugueseBrazil ? `${DOCS_ORIGIN}${DOCS_PORTUGUESE_PATH}` : DOCS_ORIGIN;
}

function SiteHeader(props: { model: PageModel }) {
  const { model } = props;
  const translate = copyOf({ locale: model.locale });
  const isJoinOffered = model.join.state !== JoinState.Joined && model.join.state !== JoinState.Paused;
  return (
    <header class="site-header">
      <div class="container">
        <a class="brand" href={SitePath.Home} aria-label={translate(SiteCopyKey.BrandHomeLabel)}>
          {translate(SiteCopyKey.BrandName)}
        </a>
        <div class="header-end">
          <a class="nav-link" href={docsHrefOf({ locale: model.locale })}>
            {translate(SiteCopyKey.NavigationDocs)}
          </a>
          <LocaleSwitch model={model} />
          {isJoinOffered ? (
            <a class="button button-primary header-join" href={HOME_FRAGMENT}>
              {translate(SiteCopyKey.HeaderJoin)}
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function SiteFooter(props: { model: PageModel }) {
  const translate = copyOf({ locale: props.model.locale });
  return (
    <footer class="site-footer">
      <div class="container">
        <div class="footer-row">
          <span>{translate(SiteCopyKey.FooterMaker)}</span>
          <ThemeSwitch model={props.model} />
        </div>
        <p class="footer-legal">{translate(SiteCopyKey.FooterTrademarks)}</p>
      </div>
    </footer>
  );
}

export function SiteLayout(props: { model: PageModel; title: string; isIndexable: boolean; children?: Child }) {
  const { model } = props;
  const translate = copyOf({ locale: model.locale });
  const description = translate(SiteCopyKey.MetaDescription, { agents: leadingAgentNamesOf({ locale: model.locale }) });
  const canonical = `${model.siteOrigin}${SitePath.Home}`;
  const pageTitle = `${props.title}${SITE_BRAND_SEPARATOR}${translate(SiteCopyKey.BrandName)}`;
  const imageUrl = `${model.siteOrigin}${SiteAsset.OpenGraphImage}`;
  const hasForm = model.join.state !== JoinState.Joined && model.join.state !== JoinState.Paused;
  const posterSourceSet = `${SiteAsset.PosterSmall} ${POSTER_SMALL_WIDTH}w, ${SiteAsset.PosterLarge} ${DEMO_IMAGE_SIZE}w`;
  const preloadAttributes = { imagesrcset: posterSourceSet, imagesizes: POSTER_SIZES, fetchpriority: 'high' };
  return (
    <html lang={LANGUAGE_TAGS[model.locale]} data-theme={model.theme}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        {props.isIndexable ? null : <meta name="robots" content="noindex" />}
        <link rel="canonical" href={canonical} />
        {Object.values(DocsLanguage).map((language) => (
          <link rel="alternate" hreflang={language} href={`${canonical}?${SITE_LANGUAGE_PARAMETER}=${language}`} />
        ))}
        <link rel="alternate" hreflang="x-default" href={canonical} />
        <meta name="theme-color" content={THEME_COLOR_LIGHT} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={THEME_COLOR_DARK} media="(prefers-color-scheme: dark)" />
        <link rel="icon" href={SitePath.Favicon} type={FAVICON_CONTENT_TYPE} />
        <link rel="apple-touch-icon" href={SiteAsset.AppleTouchIcon} />
        <link rel="preload" as="image" {...preloadAttributes} />
        <link rel="stylesheet" href={SITE_STYLESHEET_HREF} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={translate(SiteCopyKey.BrandName)} />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={translate(SiteCopyKey.MetaOgTitle)} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:width" content={String(OPEN_GRAPH_WIDTH)} />
        <meta property="og:image:height" content={String(OPEN_GRAPH_HEIGHT)} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content={translate(SiteCopyKey.MetaOgImageAlt)} />
        <meta property="og:locale" content={model.locale} />
        <meta property="og:locale:alternate" content={OPEN_GRAPH_LOCALES[model.locale]} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={translate(SiteCopyKey.MetaOgTitle)} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
        <meta name="twitter:image:alt" content={translate(SiteCopyKey.MetaOgImageAlt)} />
        <script src={SITE_SCRIPT_HREF} defer />
        {hasForm ? <script src={TURNSTILE_SCRIPT_URL} async defer /> : null}
      </head>
      <body>
        <a href={hasForm ? FORM_FRAGMENT : HOME_FRAGMENT} class="skip-link">
          {translate(SiteCopyKey.SkipToForm)}
        </a>
        <SiteHeader model={model} />
        <main id="content">{props.children}</main>
        <SiteFooter model={model} />
      </body>
    </html>
  );
}

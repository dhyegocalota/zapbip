import { COMPANY, OwnerLocale } from '@zapbip/types';
import type { Child } from 'hono/jsx';
import { FAVICON_CONTENT_TYPE } from '../../backoffice/assets/favicon';
import { type PageModel, JoinState } from '../page-model';
import {
  OPEN_GRAPH_HEIGHT,
  OPEN_GRAPH_WIDTH,
  POSTER_SIZES,
  POSTER_SMALL_WIDTH,
  DEMO_IMAGE_SIZE,
  SITE_BRAND_SEPARATOR,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  TURNSTILE_SCRIPT_URL,
  JOIN_FRAGMENT,
  THEME_SWITCH_ID,
  PRICING_FRAGMENT,
  START_FRAGMENT,
} from '../site-constants';
import { leadingAgentNames } from '../site-agents';
import { ShellControls } from '../../web-shell/shell-controls';
import { RETURN_TO_FIELD } from '../../web-shell/shell-fields';
import { ShellCopyKey, renderShellCopy } from '../../web-shell/shell-copy';
import { docsUrlOf } from '../../web-shell/shell-links';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { localePathOf } from '../site-language';
import { joinPathOf, pageUrlOf, returnPathOf } from '../site-links';
import { languageOf } from '../../web-shell/locale-profiles';
import { LegalDocument, legalPathOf } from '../legal-links';
import { legalTextOf } from '../legal-copy';
import { SITE_SCRIPT_HREF } from '../site-scripts';
import { APPLE_TOUCH_ICON_PATH, SiteAssetKind, siteAssetOf, SitePath } from '../site-paths';
import { pricingValuesOf } from '../price-format';
import { SITE_STYLESHEET_HREF } from '../site-stylesheet';

const OPEN_GRAPH_LOCALES: Record<OwnerLocale, OwnerLocale> = {
  [OwnerLocale.PortugueseBrazil]: OwnerLocale.EnglishUs,
  [OwnerLocale.EnglishUs]: OwnerLocale.PortugueseBrazil,
};
const TURNSTILE_LANGUAGES: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'pt-br',
  [OwnerLocale.EnglishUs]: 'en',
};
const FORM_FRAGMENT = '#join-email';
const CONTENT_FRAGMENT = '#content';
const MAILTO_PREFIX = 'mailto:';
const LEGAL_LINKS: { document: LegalDocument; label: ShellCopyKey }[] = [
  { document: LegalDocument.Terms, label: ShellCopyKey.FooterTerms },
  { document: LegalDocument.Privacy, label: ShellCopyKey.FooterPrivacy },
];

export function turnstileLanguageOf(input: { locale: OwnerLocale }): string {
  return TURNSTILE_LANGUAGES[input.locale];
}

function skipLinkOf(input: { isLegalPage: boolean; hasForm: boolean }): { href: string; label: SiteCopyKey } {
  if (input.isLegalPage) return { href: CONTENT_FRAGMENT, label: SiteCopyKey.SkipToContent };
  if (input.hasForm) return { href: FORM_FRAGMENT, label: SiteCopyKey.SkipToForm };
  return { href: JOIN_FRAGMENT, label: SiteCopyKey.SkipToForm };
}

function descriptionOf(input: { model: PageModel }): string {
  const { model } = input;
  if (model.legalDocument !== null) return legalTextOf({ document: model.legalDocument, locale: model.locale }).description;
  return copyOf({ locale: model.locale })(SiteCopyKey.MetaDescription, {
    ...pricingValuesOf({ locale: model.locale }),
    agents: leadingAgentNames(),
  });
}

function SiteHeader(props: { model: PageModel }) {
  const { model } = props;
  const translate = copyOf({ locale: model.locale });
  const isJoinOffered = model.join.state !== JoinState.Joined && model.join.state !== JoinState.Paused;
  const joinHref = model.legalDocument === null ? JOIN_FRAGMENT : joinPathOf({ locale: model.locale, referralCode: model.referralCode });
  return (
    <header class="site-header">
      <div class="container">
        <a class="brand" href={localePathOf({ locale: model.locale })} aria-label={translate(SiteCopyKey.BrandHomeLabel)}>
          {translate(SiteCopyKey.BrandName)}
        </a>
        <nav class="header-end" aria-label={translate(SiteCopyKey.NavigationLabel)}>
          <a class="nav-link" href={docsUrlOf({ locale: model.locale, path: '' })}>
            {translate(SiteCopyKey.NavigationDocs)}
          </a>
          {isJoinOffered ? (
            <a class="button button-primary header-join" href={joinHref}>
              {translate(SiteCopyKey.HeaderJoin)}
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function FooterColumn(props: { label: SiteCopyKey; locale: OwnerLocale; links: { href: string; text: string; rel?: string }[] }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <nav class="footer-links" aria-label={translate(props.label)}>
      <h2 class="footer-heading">{translate(props.label)}</h2>
      <ul>
        {props.links.map((link) => (
          <li>
            <a href={link.href} rel={link.rel}>
              {link.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SiteFooter(props: { model: PageModel }) {
  const { model } = props;
  const translate = copyOf({ locale: model.locale });
  const homePath = localePathOf({ locale: model.locale });
  const shellText = (key: ShellCopyKey): string => renderShellCopy({ key, locale: model.locale });
  const productLinks = [
    { href: `${homePath}${PRICING_FRAGMENT}`, text: translate(SiteCopyKey.FooterPricing) },
    { href: `${homePath}${START_FRAGMENT}`, text: translate(SiteCopyKey.FooterQuickStart) },
    { href: docsUrlOf({ locale: model.locale, path: '' }), text: shellText(ShellCopyKey.FooterDocs) },
  ];
  const legalLinks = LEGAL_LINKS.map((link) => ({
    href: legalPathOf({ document: link.document, locale: model.locale }),
    text: shellText(link.label),
  }));
  const companyLinks = [
    { href: COMPANY.website, text: shellText(ShellCopyKey.FooterMadeBy), rel: 'noopener' },
    { href: `${MAILTO_PREFIX}${COMPANY.contactEmail}`, text: shellText(ShellCopyKey.FooterSupport) },
  ];
  return (
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-controls">
            <ShellControls
              locale={model.locale}
              theme={model.theme}
              localeAction={SitePath.Locale}
              themeAction={SitePath.Theme}
              hiddenFields={[{ name: RETURN_TO_FIELD, value: returnPathOf({ model }) }]}
              themeId={THEME_SWITCH_ID}
            />
          </div>
          <FooterColumn label={SiteCopyKey.FooterProduct} locale={model.locale} links={productLinks} />
          <FooterColumn label={SiteCopyKey.FooterLegalLabel} locale={model.locale} links={legalLinks} />
          <FooterColumn label={SiteCopyKey.FooterCompany} locale={model.locale} links={companyLinks} />
        </div>
        <p class="footer-legal">{translate(SiteCopyKey.FooterTrademarks)}</p>
        <div class="footer-wordmark" aria-hidden="true">
          {translate(SiteCopyKey.BrandName)}
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout(props: { model: PageModel; title: string; isIndexable: boolean; children?: Child }) {
  const { model } = props;
  const translate = copyOf({ locale: model.locale });
  const isLegalPage = model.legalDocument !== null;
  const description = descriptionOf({ model });
  const canonical = pageUrlOf({ model, locale: model.locale });
  const pageTitle = `${props.title}${SITE_BRAND_SEPARATOR}${translate(SiteCopyKey.BrandName)}`;
  const imageUrl = `${model.siteOrigin}${siteAssetOf({ kind: SiteAssetKind.OpenGraphImage, locale: model.locale })}`;
  const hasForm = !isLegalPage && model.join.state !== JoinState.Joined && model.join.state !== JoinState.Paused;
  const skipLink = skipLinkOf({ isLegalPage, hasForm });
  const posterSourceSet = `${siteAssetOf({ kind: SiteAssetKind.PosterSmall, locale: model.locale })} ${POSTER_SMALL_WIDTH}w, ${siteAssetOf({ kind: SiteAssetKind.PosterLarge, locale: model.locale })} ${DEMO_IMAGE_SIZE}w`;
  const preloadAttributes = { imagesrcset: posterSourceSet, imagesizes: POSTER_SIZES, fetchpriority: 'high' };
  return (
    <html lang={languageOf({ locale: model.locale })} data-theme={model.theme}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        {props.isIndexable ? null : <meta name="robots" content="noindex" />}
        <link rel="canonical" href={canonical} />
        {Object.values(OwnerLocale).map((locale) => (
          <link rel="alternate" hreflang={languageOf({ locale })} href={pageUrlOf({ model, locale })} />
        ))}
        <link rel="alternate" hreflang="x-default" href={pageUrlOf({ model, locale: OwnerLocale.EnglishUs })} />
        <meta name="theme-color" content={THEME_COLOR_LIGHT} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={THEME_COLOR_DARK} media="(prefers-color-scheme: dark)" />
        <link rel="icon" href={SitePath.Favicon} type={FAVICON_CONTENT_TYPE} />
        <link rel="apple-touch-icon" href={APPLE_TOUCH_ICON_PATH} />
        {isLegalPage ? null : <link rel="preload" as="image" {...preloadAttributes} />}
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
        <a href={skipLink.href} class="skip-link">
          {translate(skipLink.label)}
        </a>
        <SiteHeader model={model} />
        <main id="content">{props.children}</main>
        <SiteFooter model={model} />
      </body>
    </html>
  );
}

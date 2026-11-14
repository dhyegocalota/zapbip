import { legalTextOf } from './legal-copy';
import type { PageModel } from './page-model';
import { pricingValuesOf } from './price-format';
import { leadingAgentNames } from './site-agents';
import { SITE_BRAND_SEPARATOR } from './site-constants';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';

export type PageMeta = { title: string; description: string; openGraphTitle: string };

export function pageMetaOf(input: { model: PageModel; title: string }): PageMeta {
  const { model, title } = input;
  const translate = copyOf({ locale: model.locale });
  const brandedTitle = `${title}${SITE_BRAND_SEPARATOR}${translate(SiteCopyKey.BrandName)}`;
  if (model.legalDocument !== null) {
    const legalText = legalTextOf({ document: model.legalDocument, locale: model.locale });
    return { title: brandedTitle, description: legalText.description, openGraphTitle: title };
  }
  const description = translate(SiteCopyKey.MetaDescription, { ...pricingValuesOf({ locale: model.locale }), agents: leadingAgentNames() });
  return { title: brandedTitle, description, openGraphTitle: translate(SiteCopyKey.MetaOgTitle) };
}

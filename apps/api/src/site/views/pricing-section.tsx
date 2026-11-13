import { PRICING_CURRENCY_BY_LOCALE, type OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { JOIN_FRAGMENT } from '../site-constants';
import { formatPrice, pricingValuesOf } from '../price-format';

const CHECK_GLYPH = '✓';
const FREE_PRICE_CENTS = 0;
const FREE_FEATURE_KEYS = [
  SiteCopyKey.PricingFreePhone,
  SiteCopyKey.PricingFreeAgents,
  SiteCopyKey.PricingFreeAsk,
  SiteCopyKey.PricingFreeRouting,
  SiteCopyKey.PricingFreeWake,
];

export function PricingSection(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
  const values = pricingValuesOf({ locale: props.locale });
  const freePrice = formatPrice({ cents: FREE_PRICE_CENTS, currency: PRICING_CURRENCY_BY_LOCALE[props.locale], locale: props.locale });
  return (
    <section class="block" id="pricing" aria-labelledby="pricing-title">
      <div class="container">
        <p class="eyebrow reveal">{translate(SiteCopyKey.PricingEyebrow)}</p>
        <h2 class="section-title reveal" id="pricing-title">
          {translate(SiteCopyKey.PricingTitle)}
        </h2>
        <p class="lead reveal">{translate(SiteCopyKey.PricingLead)}</p>
        <div class="plans">
          <article class="card plan plan-free hero-card reveal">
            <h3 class="plan-name">{translate(SiteCopyKey.PricingFreeName)}</h3>
            <p class="plan-price">
              <span class="plan-amount">{freePrice}</span>
              <span class="plan-note">{translate(SiteCopyKey.PricingFreeNote, values)}</span>
            </p>
            <ul class="plan-list" aria-label={translate(SiteCopyKey.PricingFreeIncludes)}>
              {FREE_FEATURE_KEYS.map((key) => (
                <li>
                  <span class="check" aria-hidden="true">
                    {CHECK_GLYPH}
                  </span>
                  {translate(key)}
                </li>
              ))}
            </ul>
            <a class="button button-primary button-arrow" href={JOIN_FRAGMENT}>
              {translate(SiteCopyKey.PricingCta)}
            </a>
          </article>
          <article class="card plan plan-pro reveal">
            <h3 class="plan-name">{translate(SiteCopyKey.PricingProName)}</h3>
            <p class="plan-price">
              <span class="plan-amount">{values.price}</span>
              <span class="plan-period">{translate(SiteCopyKey.PricingProPeriod)}</span>
            </p>
            <ul class="plan-list">
              <li>
                <span class="check" aria-hidden="true">
                  {CHECK_GLYPH}
                </span>
                {translate(SiteCopyKey.PricingProIncluded, values)}
              </li>
              <li>
                <span class="check" aria-hidden="true">
                  {CHECK_GLYPH}
                </span>
                {translate(SiteCopyKey.PricingProOverage, values)}
              </li>
            </ul>
            <a class="button button-secondary" href={JOIN_FRAGMENT}>
              {translate(SiteCopyKey.PricingProCta)}
            </a>
            <p class="plan-billing">{translate(SiteCopyKey.PricingBilling)}</p>
          </article>
        </div>
        <p class="plan-definition reveal">{translate(SiteCopyKey.PricingMessageDefinition)}</p>
      </div>
    </section>
  );
}

import type { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';

const CHECK_GLYPH = '✓';
const JOIN_FRAGMENT = '#join';
const FREE_FEATURE_KEYS = [
  SiteCopyKey.PricingFreePhone,
  SiteCopyKey.PricingFreeAgents,
  SiteCopyKey.PricingFreeAsk,
  SiteCopyKey.PricingFreeRouting,
  SiteCopyKey.PricingFreeWake,
];

export function PricingSection(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
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
              <span class="plan-amount">{translate(SiteCopyKey.PricingFreePrice)}</span>
              <span class="plan-note">{translate(SiteCopyKey.PricingFreeNote)}</span>
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
            <p>{translate(SiteCopyKey.PricingProNote)}</p>
          </article>
        </div>
      </div>
    </section>
  );
}

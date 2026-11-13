import type { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { ContactText } from './contact-text';
import { pricingValuesOf } from '../price-format';
import { faqItemsOf } from '../faq-items';

export function FaqSection(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
  const values = pricingValuesOf({ locale: props.locale });
  return (
    <section class="block" id="faq" aria-labelledby="faq-title">
      <div class="container faq">
        <p class="eyebrow reveal">{translate(SiteCopyKey.FaqEyebrow)}</p>
        <h2 class="section-title reveal" id="faq-title">
          {translate(SiteCopyKey.FaqTitle)}
        </h2>
        {faqItemsOf().map((item) => (
          <details class="reveal">
            <summary>{translate(item.question)}</summary>
            <p>
              <ContactText text={translate(item.answer, values)} />
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

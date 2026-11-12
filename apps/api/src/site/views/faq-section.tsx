import type { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { ContactText } from './contact-text';

const FAQ_ITEMS: { question: SiteCopyKey; answer: SiteCopyKey }[] = [
  { question: SiteCopyKey.FaqWhenQuestion, answer: SiteCopyKey.FaqWhenAnswer },
  { question: SiteCopyKey.FaqFreeQuestion, answer: SiteCopyKey.FaqFreeAnswer },
  { question: SiteCopyKey.FaqPriceQuestion, answer: SiteCopyKey.FaqPriceAnswer },
  { question: SiteCopyKey.FaqDeveloperQuestion, answer: SiteCopyKey.FaqDeveloperAnswer },
  { question: SiteCopyKey.FaqOthersQuestion, answer: SiteCopyKey.FaqOthersAnswer },
  { question: SiteCopyKey.FaqManyQuestion, answer: SiteCopyKey.FaqManyAnswer },
  { question: SiteCopyKey.FaqReferralQuestion, answer: SiteCopyKey.FaqReferralAnswer },
  { question: SiteCopyKey.FaqDataQuestion, answer: SiteCopyKey.FaqDataAnswer },
];

export function FaqSection(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="block" id="faq" aria-labelledby="faq-title">
      <div class="container faq">
        <p class="eyebrow reveal">{translate(SiteCopyKey.FaqEyebrow)}</p>
        <h2 class="section-title reveal" id="faq-title">
          {translate(SiteCopyKey.FaqTitle)}
        </h2>
        {FAQ_ITEMS.map((item) => (
          <details class="reveal">
            <summary>{translate(item.question)}</summary>
            <p>
              <ContactText text={translate(item.answer)} />
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

import { REFERRAL_SHARING_OPEN } from './site-constants';
import { SiteCopyKey } from './site-copy';

export type FaqItem = { question: SiteCopyKey; answer: SiteCopyKey };

const FAQ_ITEMS: FaqItem[] = [
  { question: SiteCopyKey.FaqWhenQuestion, answer: SiteCopyKey.FaqWhenAnswer },
  { question: SiteCopyKey.FaqFreeQuestion, answer: SiteCopyKey.FaqFreeAnswer },
  { question: SiteCopyKey.FaqPriceQuestion, answer: SiteCopyKey.FaqPriceAnswer },
  { question: SiteCopyKey.FaqOwnNumberQuestion, answer: SiteCopyKey.FaqOwnNumberAnswer },
  { question: SiteCopyKey.FaqDeveloperQuestion, answer: SiteCopyKey.FaqDeveloperAnswer },
  { question: SiteCopyKey.FaqOthersQuestion, answer: SiteCopyKey.FaqOthersAnswer },
  { question: SiteCopyKey.FaqManyQuestion, answer: SiteCopyKey.FaqManyAnswer },
  { question: SiteCopyKey.FaqReferralQuestion, answer: SiteCopyKey.FaqReferralAnswer },
  { question: SiteCopyKey.FaqDataQuestion, answer: SiteCopyKey.FaqDataAnswer },
];

export function faqItemsOf(): FaqItem[] {
  return FAQ_ITEMS.filter((item) => REFERRAL_SHARING_OPEN || item.question !== SiteCopyKey.FaqReferralQuestion);
}

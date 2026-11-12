import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import type { PageModel } from '../page-model';
import { CapabilitiesSection } from './capabilities-section';
import { FaqSection } from './faq-section';
import { FinalCall } from './final-call';
import { HeroSection } from './hero-section';
import { PricingSection } from './pricing-section';
import { QuickStartSection } from './quick-start-section';
import { PrivacyBand } from './privacy-band';
import { SiteLayout } from './site-layout';
import { StepsSection } from './steps-section';
import { WhySection } from './why-section';

export function LandingPage(props: { model: PageModel }) {
  const { model } = props;
  return (
    <SiteLayout model={model} title={copyOf({ locale: model.locale })(SiteCopyKey.MetaTitle)} isIndexable>
      <HeroSection model={model} />
      <WhySection locale={model.locale} />
      <StepsSection locale={model.locale} />
      <CapabilitiesSection locale={model.locale} />
      <QuickStartSection locale={model.locale} referralCode={model.referralCode} startTab={model.startTab} />
      <PricingSection locale={model.locale} />
      <PrivacyBand locale={model.locale} />
      <FaqSection locale={model.locale} />
      <FinalCall model={model} />
    </SiteLayout>
  );
}

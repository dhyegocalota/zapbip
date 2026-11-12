import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import type { PageModel } from '../page-model';
import { CapabilitiesSection } from './capabilities-section';
import { ClientsSection } from './clients-section';
import { FaqSection } from './faq-section';
import { FinalCall } from './final-call';
import { HeroSection } from './hero-section';
import { PrivacyBand } from './privacy-band';
import { SiteLayout } from './site-layout';
import { StepsSection } from './steps-section';

export function LandingPage(props: { model: PageModel }) {
  const { model } = props;
  return (
    <SiteLayout model={model} title={copyOf({ locale: model.locale })(SiteCopyKey.MetaTitle)} isIndexable>
      <HeroSection model={model} />
      <StepsSection locale={model.locale} />
      <CapabilitiesSection locale={model.locale} />
      <ClientsSection locale={model.locale} />
      <PrivacyBand locale={model.locale} />
      <FaqSection locale={model.locale} />
      <FinalCall model={model} />
    </SiteLayout>
  );
}

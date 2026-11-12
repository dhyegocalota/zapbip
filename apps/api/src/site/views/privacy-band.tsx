import type { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { ContactText } from './contact-text';

const BAND_ITEMS: { icon: string; title: SiteCopyKey; body: SiteCopyKey }[] = [
  { icon: '◈', title: SiteCopyKey.PrivacyOfficialTitle, body: SiteCopyKey.PrivacyOfficialBody },
  { icon: '◉', title: SiteCopyKey.PrivacyOnlyYouTitle, body: SiteCopyKey.PrivacyOnlyYouBody },
  { icon: '⚿', title: SiteCopyKey.PrivacyKeysTitle, body: SiteCopyKey.PrivacyKeysBody },
];

export function PrivacyBand(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="band" id="privacy" aria-labelledby="privacy-title">
      <div class="container">
        <p class="eyebrow">{translate(SiteCopyKey.PrivacyEyebrow)}</p>
        <h2 class="section-title" id="privacy-title">
          {translate(SiteCopyKey.PrivacyTitle)}
        </h2>
        <div class="band-grid">
          {BAND_ITEMS.map((item) => (
            <div class="band-item">
              <span class="band-icon" aria-hidden="true">
                {item.icon}
              </span>
              <h3>{translate(item.title)}</h3>
              <p>{translate(item.body)}</p>
            </div>
          ))}
        </div>
        <div class="band-note">
          <strong>{translate(SiteCopyKey.PrivacyWaitlistTitle)}</strong>
          <p>
            <ContactText text={translate(SiteCopyKey.PrivacyWaitlistBody)} />
          </p>
        </div>
      </div>
    </section>
  );
}

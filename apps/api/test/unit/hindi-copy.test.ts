import { DAY_MS, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { WHATSAPP_COPY } from '../../src/adapters/whatsapp/whatsapp-copy';
import { ClientAppCopyKey, renderClientAppCopy } from '../../src/client-app/client-app-copy';
import { aboutFactsOf } from '../../src/site/about-facts';
import { daysOf, legalTextOf } from '../../src/site/legal-copy';
import { LegalDocument } from '../../src/site/legal-links';
import { SITE_COPY } from '../../src/site/site-copy';

const GENDERED_FIRST_PERSON_PATTERN = /(?:ूँगा|ूंगा|ूँगी|ूंगी|ता हूँ|ती हूँ|ता हूं|ती हूं)/;
const DEVANAGARI_DIGIT_PATTERN = /[०-९]/;
const COINED_TERMS = ['अभिकर्ता', 'कड़ी', 'संकेत-वाक्य'];

function productTexts(): string[] {
  const legal = Object.values(LegalDocument).flatMap((document) => {
    const text = legalTextOf({ document, locale: OwnerLocale.Hindi });
    return [
      text.title,
      text.description,
      text.summary,
      ...text.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...section.items]),
    ];
  });
  return [
    ...Object.values(SITE_COPY[OwnerLocale.Hindi]),
    ...Object.values(ClientAppCopyKey).map((key) => renderClientAppCopy({ key, locale: OwnerLocale.Hindi })),
    ...Object.values(WHATSAPP_COPY[OwnerLocale.Hindi]),
    ...legal,
  ];
}

describe('the Hindi day counts', () => {
  it('keeps the count bare, because the noun दिन follows it in the copy', () => {
    expect(daysOf({ milliseconds: 7 * DAY_MS, locale: OwnerLocale.Hindi })).toBe('7');
  });

  it('reads the retention counts with दिन in the privacy policy and the About facts', () => {
    const privacy = JSON.stringify(legalTextOf({ document: LegalDocument.Privacy, locale: OwnerLocale.Hindi }));
    const about = aboutFactsOf({ locale: OwnerLocale.Hindi }).lines.join('\n');
    [privacy, about].forEach((text) => {
      expect(text).toContain('7 दिन');
      expect(text).toContain('30 दिन');
    });
  });
});

describe('the Hindi product copy', () => {
  it('never speaks in a gendered first person', () => {
    expect(productTexts().filter((text) => GENDERED_FIRST_PERSON_PATTERN.test(text))).toEqual([]);
  });

  it('writes numbers with Latin digits', () => {
    expect(productTexts().filter((text) => DEVANAGARI_DIGIT_PATTERN.test(text))).toEqual([]);
  });

  it('keeps the loanwords Indian developers use instead of coined terms', () => {
    expect(productTexts().filter((text) => COINED_TERMS.some((term) => text.includes(term)))).toEqual([]);
  });
});

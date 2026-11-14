import { DAY_MS, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { ClientAppCopyKey, renderClientAppCopy } from '../../src/client-app/client-app-copy';
import { aboutFactsOf } from '../../src/site/about-facts';
import { daysOf } from '../../src/site/legal-copy';
import { LegalDocument } from '../../src/site/legal-links';
import { legalTextOf } from '../../src/site/legal-copy';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';

const LEFT_TO_RIGHT_ISOLATE = '⁦';
const POP_DIRECTIONAL_ISOLATE = '⁩';
const PHONE = '+55 11 98765-4321';
const ASCII_ONLY_PATTERN = /^[\x20-\x7E]+$/;

describe('the Arabic day counts', () => {
  it.each([
    [1, '1 يوم'],
    [2, '2 يومين'],
    [3, '3 أيام'],
    [7, '7 أيام'],
    [10, '10 أيام'],
    [11, '11 يومًا'],
    [30, '30 يومًا'],
    [100, '100 يوم'],
  ])('writes %i days as %s', (days, text) => {
    expect(daysOf({ milliseconds: days * DAY_MS, locale: OwnerLocale.Arabic })).toBe(text);
  });

  it('leaves the count of every other language as the bare number', () => {
    expect(daysOf({ milliseconds: 7 * DAY_MS, locale: OwnerLocale.EnglishUs })).toBe('7');
    expect(daysOf({ milliseconds: 30 * DAY_MS, locale: OwnerLocale.German })).toBe('30');
  });

  it('puts the right noun after the retention counts in the About facts', () => {
    const text = aboutFactsOf({ locale: OwnerLocale.Arabic }).lines.join('\n');
    expect(text).toContain('7 أيام');
    expect(text).toContain('30 يومًا');
  });

  it('puts the right noun after the retention counts in the privacy policy', () => {
    const text = JSON.stringify(legalTextOf({ document: LegalDocument.Privacy, locale: OwnerLocale.Arabic }));
    expect(text).toContain('7 أيام');
    expect(text).toContain('30 يومًا');
    expect(text).not.toContain('30 يومًا يومًا');
  });
});

describe('the Arabic copy that carries left-to-right text', () => {
  it.each([ClientAppCopyKey.ContinueAs, ClientAppCopyKey.SignedInAs])('isolates the phone number in %s', (key) => {
    const text = renderClientAppCopy({ key, locale: OwnerLocale.Arabic, values: { phone: PHONE } });
    expect(text).toContain(`${LEFT_TO_RIGHT_ISOLATE}${PHONE}${POP_DIRECTIONAL_ISOLATE}`);
  });

  it('keeps the phone number bare in the other languages', () => {
    const text = renderClientAppCopy({ key: ClientAppCopyKey.ContinueAs, locale: OwnerLocale.German, values: { phone: PHONE } });
    expect(text).not.toContain(LEFT_TO_RIGHT_ISOLATE);
  });

  it('names the demo file with a single left-to-right token', () => {
    expect(renderSiteCopy({ key: SiteCopyKey.CapabilityMediaChatFile, locale: OwnerLocale.Arabic })).toMatch(ASCII_ONLY_PATTERN);
  });
});

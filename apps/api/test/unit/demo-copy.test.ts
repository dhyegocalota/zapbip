import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { demoScriptOf, openGraphDataOf, type LocaleScript } from '../../scripts/landing-demo/demo-copy';
import { SENDER_INDEXES, senderNameOf } from '../../src/site/site-agents';
import { SiteCopyKey } from '../../src/site/site-copy';
import { copyOf } from '../../src/site/site-copy-text';

const LOCALES = Object.values(OwnerLocale);
const TRANSLATED_FIELDS: (keyof LocaleScript)[] = [
  'command',
  'testsPassed',
  'question',
  'deployCommand',
  'liveText',
  'optionsLabel',
  'waitingLabel',
  'answeredLabel',
];
const TAGLINE_PREFIX = 'zapbip.com · ';

describe.each(LOCALES)('the demo script in %s', (locale) => {
  const script = demoScriptOf({ locale });
  const translate = copyOf({ locale });

  it('takes the question, the buttons and the reply from the site copy', () => {
    expect(script.terminalQuestion).toBe(translate(SiteCopyKey.WhyAskQuestion));
    expect(script.options).toEqual([translate(SiteCopyKey.WhyAskShip), translate(SiteCopyKey.WhyAskWait)]);
    expect(script.doneText).toBe(translate(SiteCopyKey.WhyAskDone));
    expect(script.question).toContain(script.terminalQuestion);
  });

  it('leaves no field blank or with an unfilled placeholder', () => {
    Object.values(script)
      .flat()
      .forEach((text) => {
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/\{[a-z]+\}/i);
      });
  });

  it('draws the Open Graph card from the same words', () => {
    expect(openGraphDataOf({ locale })).toEqual({
      titleLead: translate(SiteCopyKey.HeroTitleLead),
      titleAccent: translate(SiteCopyKey.HeroTitleAccent),
      tagline: `${TAGLINE_PREFIX}${translate(SiteCopyKey.FinalButton)}`,
      agentName: senderNameOf({ index: SENDER_INDEXES.first }),
      questionShort: script.question,
      options: script.options,
    });
  });
});

describe('the demo scripts across languages', () => {
  const english = demoScriptOf({ locale: OwnerLocale.EnglishUs });

  it.each(LOCALES.filter((locale) => locale !== OwnerLocale.EnglishUs))('words every terminal line of %s apart from English', (locale) => {
    const script = demoScriptOf({ locale });
    TRANSLATED_FIELDS.forEach((field) => expect(script[field]).not.toBe(english[field]));
  });
});

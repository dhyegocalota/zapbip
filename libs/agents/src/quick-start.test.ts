import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CONNECTION_LINK, sectionInput } from '../testing/install-fixtures';
import { AGENT_INSTALLS } from './generated/install';

const LOCALES = Object.values(OwnerLocale);
const INSTALLS = Object.entries(AGENT_INSTALLS);

describe.each(INSTALLS)('the quick start of %s', (_id, install) => {
  describe.each(LOCALES)('in %s', (locale) => {
    const quickStartOf = () => install.quickStart({ locale, connectionLink: CONNECTION_LINK });

    test('says where to paste and shows the link it was given', () => {
      expect(quickStartOf().hint.length).toBeGreaterThan(0);
      expect(quickStartOf().code).toContain(CONNECTION_LINK);
    });

    test('proves itself with text that is part of the code', () => {
      expect(quickStartOf().code).toContain(quickStartOf().proof);
    });

    test('is the same text the install section tells the agent to use', () => {
      expect(install.render(sectionInput({ locale }))).toContain(quickStartOf().proof);
    });
  });

  test('lists a click path, in two languages, exactly when the code is only the address', () => {
    const [english, portuguese] = LOCALES.map((locale) => install.quickStart({ locale, connectionLink: CONNECTION_LINK }));
    const isAddressOnly = english!.code === CONNECTION_LINK;
    expect(english!.path.length > 0).toBe(isAddressOnly);
    expect(portuguese!.path.length).toBe(english!.path.length);
    expect(portuguese!.path).not.toEqual(english!.path.length === 0 ? [''] : english!.path);
    expect([...english!.path, ...portuguese!.path].filter((step) => step.trim().length === 0)).toEqual([]);
  });

  test('is written in two languages', () => {
    const [first, second] = LOCALES.map((locale) => install.quickStart({ locale, connectionLink: CONNECTION_LINK }).hint);
    expect(first).not.toBe(second);
  });
});

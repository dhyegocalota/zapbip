import { INSTALL_PRODUCT_TEXT_MAX_LENGTH, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { definition as fixtureDefinition } from '../../testing/fixture-agent/definition';
import { install as fixtureInstall } from '../../testing/fixture-agent/install';
import type { InstallSection } from '@zapbip/core';
import { AGENT_DEFINITIONS } from '../generated/definitions';
import { AGENT_INSTALLS } from '../generated/install';
import { installSectionViolationsOf, type InstallSectionEntry } from './install-sections';

const FIXTURE_ID = 'fixture-agent';
const LABEL = `${FIXTURE_ID} in ${OwnerLocale.EnglishUs}`;
const SECOND_STEP_LINE = /^(2\. .*)$/m;

function realEntries(): InstallSectionEntry[] {
  return Object.entries(AGENT_INSTALLS).map(([id, install]) => {
    const definition = Object.entries(AGENT_DEFINITIONS).find(([definitionId]) => definitionId === id)?.[1];
    if (!definition) throw new Error(`${id} has an install section and no definition`);
    return { id, install, definition };
  });
}

function fixtureEntryRendering(input: { render: InstallSection }): InstallSectionEntry {
  return { id: FIXTURE_ID, install: { ...fixtureInstall, render: input.render }, definition: fixtureDefinition };
}

function fixtureEntryEditing(input: { edit: (text: string) => string }): InstallSectionEntry {
  return fixtureEntryRendering({ render: (section) => input.edit(fixtureInstall.render(section)) });
}

describe('installSectionViolationsOf', () => {
  test('accepts the install section of every real agent', () => {
    expect(installSectionViolationsOf({ entries: realEntries() })).toEqual([]);
  });

  test('accepts the fixture section', () => {
    expect(installSectionViolationsOf({ entries: [fixtureEntryEditing({ edit: (text) => text })] })).toEqual([]);
  });

  test('rejects a section that does not open with its product heading', () => {
    const entry = fixtureEntryEditing({ edit: (text) => text.replace('## Fixture Agent', '## Other Product') });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: the section must open with the heading ## Fixture Agent`);
  });

  test('rejects a section whose first step is not the stop check', () => {
    const entry = fixtureEntryEditing({ edit: (text) => text.replace('1. If you are not', '1. Do not be') });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: step 1 must be the stop check`);
  });

  test('rejects a section that does not end with the self-test', () => {
    const entry = fixtureEntryEditing({ edit: (text) => `${text}\n\nThanks.` });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: the last line must be the self-test`);
  });

  test('rejects a step that does not state its success', () => {
    const entry = fixtureEntryEditing({
      edit: (text) => text.replace('Success: the settings list zapbip.', 'Result: the settings list zapbip.'),
    });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: every step must state its success`);
  });

  test('rejects a set_wake mode the definition does not list', () => {
    const entry = fixtureEntryEditing({ edit: (text) => text.replace(SECOND_STEP_LINE, '$1 set_wake({mode: "local"})') });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: set_wake modes local are not in its definition`);
  });

  test('rejects the connection secret outside the connection link', () => {
    const entry = fixtureEntryEditing({ edit: (text) => text.replace(SECOND_STEP_LINE, '$1 zb_conn_FAKE') });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(
      `${LABEL}: the connection secret must appear only inside the connection link`,
    );
  });

  test('rejects a section that renders differently each time', () => {
    let calls = 0;
    const entry = fixtureEntryEditing({ edit: (text) => text.replace(SECOND_STEP_LINE, `$1 call ${calls++}`) });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: rendering twice must give the same text`);
  });

  test('rejects a package version that does not come from ZAPBIP_NPM_VERSION', () => {
    const entry = fixtureEntryEditing({ edit: (text) => text.replace(SECOND_STEP_LINE, '$1 npx zapbip@9.9.9 listen') });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: the package version must come from ZAPBIP_NPM_VERSION`);
  });

  test('refuses a section with a second heading', () => {
    const entry = fixtureEntryEditing({ edit: (text) => `${text}\n\n## Other` });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: the section must hold exactly one heading`);
  });

  test('refuses a section with a heading of the first level too', () => {
    const entry = fixtureEntryEditing({ edit: (text) => `${text}\n\n# Other` });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: the section must hold exactly one heading`);
  });

  test.each([
    ['productName', 'Fixture\nAgent'],
    ['productName', 'x'.repeat(INSTALL_PRODUCT_TEXT_MAX_LENGTH + 1)],
    ['productDescription', 'one line\n## Injected'],
    ['productDescription', 'x'.repeat(INSTALL_PRODUCT_TEXT_MAX_LENGTH + 1)],
  ])('refuses a %s that is not one short line', (field, value) => {
    const entry = { ...fixtureEntryRendering({ render: fixtureInstall.render }), install: { ...fixtureInstall, [field]: value } };
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(
      `${FIXTURE_ID}: the ${field === 'productName' ? 'product name' : 'product description'} must be one line of at most ${INSTALL_PRODUCT_TEXT_MAX_LENGTH} characters`,
    );
  });

  test.each([
    ['an underlined line', '\n\nOther\n-----'],
    ['a second underlined line', '\n\nOther\n====='],
  ])('refuses a section with %s heading', (_name, tail) => {
    const entry = fixtureEntryEditing({ edit: (text) => `${text}${tail}` });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: the section must hold exactly one heading`);
  });

  test.each(['one\u2028two', 'one\u2029two'])('refuses a product name with the line separator %j', (productName) => {
    const entry = { ...fixtureEntryRendering({ render: fixtureInstall.render }), install: { ...fixtureInstall, productName } };
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(
      `${FIXTURE_ID}: the product name must be one line of at most ${INSTALL_PRODUCT_TEXT_MAX_LENGTH} characters`,
    );
  });

  test.each([
    ['a tab after the marker', '\n\n##\tOther'],
    ['an indented marker', '\n\n   ## Other'],
    ['a bare marker', '\n\n##'],
    ['an indented underline', '\n\nOther\n   ==='],
    ['carriage-return line ends', '\r\rOther\r===\r'],
    ['an inline fence that is no fence', '\n\n```a```\n## Other'],
    ['a heading inside a list item', '\n\n1. step\n   ## Other'],
  ])('refuses a second heading hidden behind %s', (_name, tail) => {
    const entry = fixtureEntryEditing({ edit: (text) => `${text}${tail}` });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: the section must hold exactly one heading`);
  });

  test.each(['one\vtwo', 'one\ftwo', 'one\u0085two'])('refuses a product name with the separator %j', (productName) => {
    const entry = { ...fixtureEntryRendering({ render: fixtureInstall.render }), install: { ...fixtureInstall, productName } };
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(
      `${FIXTURE_ID}: the product name must be one line of at most ${INSTALL_PRODUCT_TEXT_MAX_LENGTH} characters`,
    );
  });

  test('refuses two entries that share a product name', () => {
    const first = fixtureEntryEditing({ edit: (text) => text });
    const second = { ...first, id: 'other-agent' };
    expect(installSectionViolationsOf({ entries: [first, second] })).toContain(
      `other-agent: the product name ${fixtureInstall.productName} is also used by ${FIXTURE_ID}`,
    );
  });

  test.each([
    ['an html heading', '\n\n<h2>Other</h2>'],
    ['an inline html heading', '\n\nText <h2>Other</h2>'],
    ['a component heading', '\n\n<Heading level={2}>Other</Heading>'],
    ['a marker without a space', '\n\n##Other'],
    ['an unclosed fence', '\n\n```\n'],
    ['an unclosed comment', '\n\n<!--'],
  ])('refuses a section with %s', (_name, tail) => {
    const entry = fixtureEntryEditing({ edit: (text) => `${text}${tail}` });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: the section must hold exactly one heading`);
  });

  test.each([
    ['a zero-width space', '\n\n\u200B## Other'],
    ['a byte order mark', '\n\n\uFEFF## Other'],
    ['a line separator', '\n\n\u2028## Other'],
  ])('refuses a section with %s', (_name, tail) => {
    const entry = fixtureEntryEditing({ edit: (text) => `${text}${tail}` });
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(`${LABEL}: the section must not hold format characters`);
  });

  test.each([
    ['productName', 'Fixture\u200BAgent'],
    ['productDescription', 'one\uFEFFline'],
  ])('refuses a %s with a format character', (field, value) => {
    const entry = { ...fixtureEntryRendering({ render: fixtureInstall.render }), install: { ...fixtureInstall, [field]: value } };
    expect(installSectionViolationsOf({ entries: [entry] })).toContain(
      `${FIXTURE_ID}: the ${field === 'productName' ? 'product name' : 'product description'} must not hold format characters`,
    );
  });

  test.each(['fixture agent', 'Fixture  Agent', 'Fixture\u200B Agent', '\uFF26ixture Agent'])(
    'refuses the lookalike product name %j',
    (productName) => {
      const first = fixtureEntryEditing({ edit: (text) => text });
      const second = { ...first, id: 'other-agent', install: { ...first.install, productName } };
      expect(installSectionViolationsOf({ entries: [first, second] })).toContain(
        `other-agent: the product name ${productName} is also used by ${FIXTURE_ID}`,
      );
    },
  );
});

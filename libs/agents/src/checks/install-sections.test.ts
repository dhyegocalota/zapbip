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
});

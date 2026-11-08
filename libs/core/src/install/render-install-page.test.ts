import { INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AGENT_RULES } from '../agent-rules';
import { INSTALL_PAGE_COPY } from './install-page-copy';
import type { InstallPageSection } from './prompts/install-section';
import { renderInstallPage, type InstallPageInput } from './render-install-page';
import { CONNECTION_LINK, LOCALES, lastNonEmptyLine } from './testing/fixtures';

const IDENTIFY_HEADING = '## Identify your product';
const RULES_HEADING = '## Rules you follow after install';

const SECTIONS: InstallPageSection[] = [
  {
    productName: 'First Product',
    render: (input) => `## First Product\n\n1. connect ${input.connectionLink}\n2. standby ${input.standbyAgent}`,
  },
  {
    productName: 'Second Product',
    render: (input) => `## Second Product\n\n1. send ${INSTALL_SELF_TEST_TEXT[input.locale]}`,
  },
];

function pageInput(input: { locale: OwnerLocale; standbyAgent?: string | null }): InstallPageInput {
  return {
    agent: 'Ana',
    connectionLink: CONNECTION_LINK,
    locale: input.locale,
    standbyAgent: input.standbyAgent === undefined ? null : input.standbyAgent,
    sections: SECTIONS,
  };
}

describe('renderInstallPage', () => {
  describe.each(LOCALES)('in %s', (locale) => {
    const page = renderInstallPage(pageInput({ locale }));

    test('orders identify, rules and the given sections, each heading once', () => {
      const headings = [IDENTIFY_HEADING, RULES_HEADING, ...SECTIONS.map((section) => `## ${section.productName}`)];
      const positions = headings.map((heading) => page.split('\n').indexOf(heading));
      expect(positions.every((position) => position > -1)).toBe(true);
      expect([...positions].sort((left, right) => left - right)).toEqual(positions);
      headings.forEach((heading) => expect(page.split('\n').filter((line) => line === heading)).toHaveLength(1));
    });

    test('lists the product names of the given sections', () => {
      expect(page).toContain('Find which product you run in: First Product, Second Product.');
    });

    test('carries the agent rules verbatim', () => {
      expect(page).toContain(AGENT_RULES);
    });

    test('ends with the company footer, after the self-test line', () => {
      expect(lastNonEmptyLine(page)).toBe(INSTALL_PAGE_COPY[locale].footer);
      expect(lastNonEmptyLine(page)).toContain('Logic Bit');
      expect(page.lastIndexOf(INSTALL_SELF_TEST_TEXT[locale])).toBeLessThan(page.lastIndexOf(INSTALL_PAGE_COPY[locale].footer));
    });

    test('carries the localized unsupported-product stop line naming zapbip', () => {
      expect(page).toContain(INSTALL_PAGE_COPY[locale].unsupportedProduct);
      expect(INSTALL_PAGE_COPY[locale].unsupportedProduct).toContain('zapbip');
    });

    test('writes the connection secret only inside the connection link', () => {
      expect(page.replaceAll(CONNECTION_LINK, '')).not.toContain('zb_conn_FAKE');
    });

    test('tells the AI to warn the owner never to paste the link anywhere else', () => {
      expect(page).toContain('Tell the owner never to paste the connection address into any other chat or app.');
    });

    test('renders the same page twice', () => {
      expect(renderInstallPage(pageInput({ locale }))).toBe(page);
    });
  });

  test('passes the standby agent to the sections', () => {
    const page = renderInstallPage(pageInput({ locale: OwnerLocale.EnglishUs, standbyAgent: 'Ana Bot' }));
    expect(page).toContain('2. standby Ana Bot');
  });

  test('renders only the sections it is given', () => {
    const page = renderInstallPage({ ...pageInput({ locale: OwnerLocale.EnglishUs }), sections: [SECTIONS[0] as InstallPageSection] });
    expect(page).toContain('Find which product you run in: First Product.');
    expect(page).not.toContain('## Second Product');
  });
});

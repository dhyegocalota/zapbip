import { INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AGENT_RULES } from '../agent-rules';
import { INSTALL_PAGE_COPY } from './install-page-copy';
import { INSTALL_PRODUCTS } from './install-products';
import { renderInstallPage, type InstallPageInput } from './render-install-page';
import { CLIENTS, CONNECTION_LINK, LOCALES, lastNonEmptyLine } from './testing/fixtures';

const IDENTIFY_HEADING = '## Identify your product';
const RULES_HEADING = '## Rules you follow after install';

function pageInput(input: { locale: OwnerLocale; standbyAgent?: string | null }): InstallPageInput {
  return {
    agent: 'Ana',
    connectionLink: CONNECTION_LINK,
    locale: input.locale,
    standbyAgent: input.standbyAgent === undefined ? null : input.standbyAgent,
  };
}

describe('renderInstallPage', () => {
  describe.each(LOCALES)('in %s', (locale) => {
    const page = renderInstallPage(pageInput({ locale }));

    test('orders identify, rules and the ten clients, each heading once', () => {
      const headings = [IDENTIFY_HEADING, RULES_HEADING, ...CLIENTS.map((client) => `## ${INSTALL_PRODUCTS[client].name}`)];
      const positions = headings.map((heading) => page.split('\n').indexOf(heading));
      expect(positions.every((position) => position > -1)).toBe(true);
      expect([...positions].sort((left, right) => left - right)).toEqual(positions);
      headings.forEach((heading) => expect(page.split('\n').filter((line) => line === heading)).toHaveLength(1));
    });

    test('IS-S7 names the package version only through ZAPBIP_NPM_VERSION', () => {
      const versions = [...page.matchAll(/zapbip@(\S+)/g)].map((match) => match[1]);
      expect(versions.length).toBeGreaterThan(0);
      versions.forEach((version) => expect(version).toBe(ZAPBIP_NPM_VERSION));
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

  test('passes the standby agent to the Grok web section', () => {
    const page = renderInstallPage(pageInput({ locale: OwnerLocale.EnglishUs, standbyAgent: 'Ana Bot' }));
    expect(page).toContain('set_wake({mode: "standby", standby_agent: "Ana Bot"})');
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderInstallPage } from '@zapbip/core';
import { DocsLanguage, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AGENT_DEFINITIONS } from '../src/generated/definitions';
import { AGENT_INSTALLS, INSTALL_PAGE_SECTIONS } from '../src/generated/install';
import { agentOrderOf } from '../src/order';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONNECTION_LINK = 'https://surfaces.example/c/zb_conn_SURFACES/mcp';
const PAGE_OWNER = 'Ana';
const MATRIX_LINK_PATTERN = /\]\(\/(?:pt-br\/)?agents\/([a-z0-9-]+)\)/;
const SECTION_MARKER = '## ';
const FIXED_HEADINGS = ['## Identify your product', '## Rules you follow after install'];
const MATRIX_SNIPPET: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'apps/docs/snippets/agents/matrix.mdx',
  [DocsLanguage.PortugueseBrazil]: 'apps/docs/snippets/pt-br/agents/matrix.mdx',
};

const registryOrder = agentOrderOf({ definitions: AGENT_DEFINITIONS });

function matrixOrderOf(input: { language: DocsLanguage }): string[] {
  return readFileSync(`${REPOSITORY_ROOT}${MATRIX_SNIPPET[input.language]}`, 'utf8')
    .split('\n')
    .flatMap((line) => {
      const id = MATRIX_LINK_PATTERN.exec(line)?.[1];
      return id === undefined ? [] : [id];
    });
}

describe('the surfaces that list the agents', () => {
  test.each(Object.values(DocsLanguage))('the %s matrix lists every agent in the registry order', (language) => {
    expect(matrixOrderOf({ language })).toEqual(registryOrder);
  });

  test.each(Object.values(OwnerLocale))('the install page in %s lists the product sections in the registry order', (locale) => {
    const page = renderInstallPage({
      agent: PAGE_OWNER,
      connectionLink: CONNECTION_LINK,
      locale,
      standbyAgent: null,
      sections: INSTALL_PAGE_SECTIONS,
    });
    const headings = page
      .split('\n')
      .filter((line) => line.startsWith(SECTION_MARKER) && !FIXED_HEADINGS.includes(line))
      .map((line) => line.slice(SECTION_MARKER.length));
    const expected = registryOrder
      .filter((id) => id in AGENT_INSTALLS)
      .map((id) => AGENT_INSTALLS[id as keyof typeof AGENT_INSTALLS].productName);
    expect(headings).toEqual(expected);
  });
});

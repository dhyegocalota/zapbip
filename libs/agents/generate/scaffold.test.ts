import { describe, expect, test } from 'vitest';
import { scaffoldFilesOf } from './scaffold';
import { listSource, readSource } from './source';
import { REAL_AGENT_IDS } from './test-agents';

const TEMPLATE_FOLDER = 'libs/agents/testing/fixture-agent';
const NEW_ID = 'probe-zq-agent';

function scaffold(input: { id: string }) {
  return scaffoldFilesOf({ id: input.id, existingIds: REAL_AGENT_IDS, readSource, listSource });
}

function contentOf(input: { files: { path: string; content: string }[]; name: string }): string {
  const file = input.files.find((candidate) => candidate.path === `libs/agents/supported/${NEW_ID}/${input.name}`);
  if (!file) throw new Error(`the scaffold has no ${input.name}`);
  return file.content;
}

describe('scaffoldFilesOf', () => {
  test('copies every file of the template into the new agent folder', () => {
    const files = scaffold({ id: NEW_ID });
    expect(files.map((file) => file.path)).toEqual(listSource(TEMPLATE_FOLDER).map((name) => `libs/agents/supported/${NEW_ID}/${name}`));
  });

  test('renames the id, the enum member and the display names, and keeps nothing of the template', () => {
    const files = scaffold({ id: NEW_ID });
    const definition = contentOf({ files, name: 'definition.ts' });
    expect(definition).toContain("enumMember: 'ProbeZqAgent'");
    expect(definition).toContain("[DocsLanguage.English]: 'Probe Zq Agent'");
    expect(contentOf({ files, name: 'install-copy.ts' })).toContain('renderProbeZqAgentSection');
    expect(contentOf({ files, name: 'page.en.mdx' })).toContain('title: Probe Zq Agent');
    files.forEach((file) => expect(file.content).not.toMatch(/fixture|Agente de teste/i));
  });

  test.each(['Demo', 'demo_agent', '1demo', 'supported-agents', ''])('refuses the invalid id "%s"', (id) => {
    expect(() => scaffold({ id })).toThrow(`${id} is not a valid agent id`);
  });

  test('refuses an id that already has a folder', () => {
    const [existingId] = REAL_AGENT_IDS as [string];
    expect(() => scaffold({ id: existingId })).toThrow(`${existingId} already exists`);
  });
});

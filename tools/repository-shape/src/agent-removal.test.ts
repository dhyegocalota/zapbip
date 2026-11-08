import { ConnectorClient } from '@zapbip/agents/connector';
import { AGENT_DEFINITIONS, AgentId } from '@zapbip/agents/definitions';
import { AGENT_PLUGINS } from '@zapbip/agents/plugins';
import { discoverAgents } from '@zapbip/agents/generate';
import { afterAll, describe, expect, test } from 'vitest';
import {
  IS_INSIDE_PROOF,
  WORKTREE_PROOF_TIMEOUT_MS,
  changedPathsOf,
  checkOutHead,
  createThrowawayWorktree,
  isOutside,
  run,
} from './throwaway-worktree';

const SUPPORTED_ROOT = 'libs/agents/supported';
const SUITES = [
  ['pnpm', '--filter', '@zapbip/agents', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/repository-shape', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/connector', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/api', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/api', 'test:integration'],
  ['pnpm', 'agents:check'],
];

const connectorIds: string[] = Object.values(ConnectorClient);
const pluginIds = Object.keys(AGENT_PLUGINS);
const installOnlyId = Object.values(AgentId).find((id) => !connectorIds.includes(id) && !pluginIds.includes(id)) as string;
const removedIds = [...connectorIds, ...pluginIds, installOnlyId];

function ownedPrefixesOf(input: { id: string }): string[] {
  const plugin = Object.entries(AGENT_PLUGINS).find(([pluginId]) => pluginId === input.id)?.[1];
  const pluginPrefixes = plugin ? [`${plugin.packageFolder}/`] : [];
  return [`${SUPPORTED_ROOT}/${input.id}/`, ...pluginPrefixes];
}

const worktree = createThrowawayWorktree();

afterAll(() => worktree.remove());

describe.skipIf(IS_INSIDE_PROOF)('removing one agent of each kind', () => {
  test('removes only the agent folders and their plugin packages by hand', () => {
    expect(removedIds.length).toBeGreaterThanOrEqual(3);
    expect(removedIds.every((id) => id in AGENT_DEFINITIONS)).toBe(true);
    expect(discoverAgents({ roots: [SUPPORTED_ROOT] }).map((agent) => agent.id)).toEqual(expect.arrayContaining(removedIds));
  });

  test(
    'leaves a diff of the removed folders and the generated set only, and every suite stays green',
    async () => {
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      const removedPrefixes = removedIds.flatMap((id) => ownedPrefixesOf({ id }));
      const removal = run({ command: ['git', 'rm', '-rq', ...removedPrefixes], directory: worktree.directory });
      expect(removal.output).toBe('');
      expect(run({ command: ['pnpm', 'install', '--no-frozen-lockfile', '--offline'], directory: worktree.directory }).status).toBe(0);
      const generation = run({ command: ['pnpm', 'agents:generate'], directory: worktree.directory });
      expect(generation.status, generation.output).toBe(0);

      const outsideTheTwoFolders = changedPathsOf({ directory: worktree.directory }).filter((path) =>
        isOutside({ path, prefixes: removedPrefixes }),
      );
      expect(outsideTheTwoFolders).toEqual([]);

      const failures = SUITES.map((command) => ({ command: command.join(' '), ...run({ command, directory: worktree.directory }) }))
        .filter((suite) => suite.status !== 0)
        .map((suite) => `${suite.command}\n${suite.output.slice(-3000)}`);
      expect(failures).toEqual([]);
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );
});

import { AGENT_DEFINITIONS } from '@zapbip/agents/definitions';
import { discoverAgents } from '@zapbip/agents/generate';
import { describe, expect, test } from 'vitest';
import { SUPPORTED_ROOT, connectorIds, ownedPrefixesOf, removedIds, useThrowawayWorktrees } from './agent-lifecycle-support';
import {
  FULL_SUITES,
  IS_INSIDE_PROOF,
  WORKTREE_PROOF_TIMEOUT_MS,
  changedPathsOf,
  checkOutHead,
  failuresOf,
  installDependencies,
  isOutside,
  LockfileMode,
  run,
} from './throwaway-worktree';

const newWorktree = useThrowawayWorktrees();

describe.skipIf(IS_INSIDE_PROOF)('the agent lifecycle in a throwaway worktree', () => {
  test('the removal covers one agent of each kind', () => {
    expect(removedIds.length).toBeGreaterThanOrEqual(2);
    expect(connectorIds.length).toBeGreaterThan(removedIds.filter((id) => connectorIds.includes(id)).length);
    expect(removedIds.every((id) => id in AGENT_DEFINITIONS)).toBe(true);
    expect(discoverAgents({ roots: [SUPPORTED_ROOT] }).map((agent) => agent.id)).toEqual(expect.arrayContaining(removedIds));
  });

  test(
    'resolving the lockfile after a removal needs no registry metadata, as on a runner with a cold cache',
    () => {
      const worktree = newWorktree();
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      const removedPrefixes = removedIds.flatMap((id) => ownedPrefixesOf({ id }));
      expect(run({ command: ['git', 'rm', '-rq', ...removedPrefixes], directory: worktree.directory }).output).toBe('');
      const resolution = installDependencies({ directory: worktree.directory, lockfile: LockfileMode.Resolve });
      expect(resolution.status, resolution.output).toBe(0);
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );

  test(
    'removing one agent of each kind leaves the removed folders and the generated set as the only diff, and every suite stays green',
    () => {
      const worktree = newWorktree();
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      const removedPrefixes = removedIds.flatMap((id) => ownedPrefixesOf({ id }));
      expect(run({ command: ['git', 'rm', '-rq', ...removedPrefixes], directory: worktree.directory }).output).toBe('');
      const install = installDependencies({ directory: worktree.directory, lockfile: LockfileMode.Resolve });
      expect(install.status, install.output).toBe(0);
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
});

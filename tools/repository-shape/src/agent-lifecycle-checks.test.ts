import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  PLANTS,
  SUPPORTED_ROOT,
  UNREADABLE_FILE,
  extraHeadingEdit,
  installAgentId,
  useThrowawayWorktrees,
} from './agent-lifecycle-support';
import {
  IS_INSIDE_PROOF,
  WORKTREE_PROOF_TIMEOUT_MS,
  changedPathsOf,
  checkOutHead,
  installDependencies,
  LockfileMode,
  run,
} from './throwaway-worktree';

const newWorktree = useThrowawayWorktrees();

describe.skipIf(IS_INSIDE_PROOF)('the agent lifecycle in a throwaway worktree', () => {
  test(
    'agents:check refuses each planted violation and names the agent and the file',
    () => {
      const worktree = newWorktree();
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      const install = installDependencies({ directory: worktree.directory, lockfile: LockfileMode.Frozen });
      expect(install.status, install.output).toBe(0);
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
      const install = installDependencies({ directory: worktree.directory, lockfile: LockfileMode.Frozen });
      expect(install.status, install.output).toBe(0);
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
      const install = installDependencies({ directory: worktree.directory, lockfile: LockfileMode.Frozen });
      expect(install.status, install.output).toBe(0);
      chmodSync(join(worktree.directory, UNREADABLE_FILE), 0);
      const outcome = run({ command: ['pnpm', 'agents:check'], directory: worktree.directory });
      chmodSync(join(worktree.directory, UNREADABLE_FILE), 0o644);
      expect(outcome.status).toBe(1);
      expect(outcome.output).toContain(`${UNREADABLE_FILE}: cannot be read (EACCES)`);
      expect(outcome.output).not.toContain('node:fs');
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );
});

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
const SCAFFOLD_ID = `scaffold-probe-${Date.now().toString(36)}`;
const SUITES = [
  ['pnpm', 'agents:check'],
  ['pnpm', '--filter', '@zapbip/agents', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/repository-shape', 'test:unit'],
];

const worktree = createThrowawayWorktree();

afterAll(() => worktree.remove());

describe.skipIf(IS_INSIDE_PROOF)('scaffolding a new agent', () => {
  test(
    'passes every check as generated, changes only its folder and the generated set, and leaves the shape suite green',
    () => {
      expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
      expect(run({ command: ['pnpm', 'install', '--frozen-lockfile', '--offline'], directory: worktree.directory }).status).toBe(0);
      const scaffold = run({ command: ['pnpm', 'agents:new', SCAFFOLD_ID], directory: worktree.directory });
      expect(scaffold.status, scaffold.output).toBe(0);
      const generation = run({ command: ['pnpm', 'agents:generate'], directory: worktree.directory });
      expect(generation.status, generation.output).toBe(0);

      const outsideTheFolder = changedPathsOf({ directory: worktree.directory }).filter((path) =>
        isOutside({ path, prefixes: [`${SUPPORTED_ROOT}/${SCAFFOLD_ID}/`] }),
      );
      expect(outsideTheFolder).toEqual([]);

      const failures = SUITES.map((command) => ({ command: command.join(' '), ...run({ command, directory: worktree.directory }) }))
        .filter((suite) => suite.status !== 0)
        .map((suite) => `${suite.command}\n${suite.output.slice(-3000)}`);
      expect(failures).toEqual([]);
    },
    WORKTREE_PROOF_TIMEOUT_MS,
  );
});

import { describe, expect, test } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { IS_INSIDE_PROOF, REPOSITORY_ROOT_FOR_PROOFS, checkOutHead, createThrowawayWorktree, isOutside, run } from './throwaway-worktree';

const PLUGIN_PREFIX = 'apps/example-plugin/';
const AGENT_PREFIX = 'libs/agents/supported/example/';

describe('isOutside', () => {
  test('accepts the lockfile when a plugin package is involved', () => {
    expect(isOutside({ path: 'pnpm-lock.yaml', prefixes: [AGENT_PREFIX, PLUGIN_PREFIX] })).toBe(false);
  });

  test('refuses the lockfile when only an agent folder is involved', () => {
    expect(isOutside({ path: 'pnpm-lock.yaml', prefixes: [AGENT_PREFIX] })).toBe(true);
  });

  test('accepts the generated set and the folders themselves', () => {
    expect(isOutside({ path: 'libs/agents/src/generated/ids.ts', prefixes: [AGENT_PREFIX] })).toBe(false);
    expect(isOutside({ path: `${AGENT_PREFIX}definition.ts`, prefixes: [AGENT_PREFIX] })).toBe(false);
  });

  test('refuses any other path', () => {
    expect(isOutside({ path: 'libs/core/src/index.ts', prefixes: [AGENT_PREFIX, PLUGIN_PREFIX] })).toBe(true);
  });
});

describe.skipIf(IS_INSIDE_PROOF)('the throwaway worktree', () => {
  test('removing it also deletes the temporary parent folder', () => {
    const worktree = createThrowawayWorktree();
    const parent = dirname(worktree.directory);
    expect(existsSync(parent)).toBe(true);
    worktree.remove();
    expect(existsSync(parent)).toBe(false);
  });

  test('a checkout first prunes the worktrees whose folder is gone', () => {
    const stale = createThrowawayWorktree();
    const fresh = createThrowawayWorktree();
    expect(checkOutHead({ directory: stale.directory }).status).toBe(0);
    rmSync(stale.directory, { recursive: true, force: true });
    expect(checkOutHead({ directory: fresh.directory }).status).toBe(0);
    const listing = run({ command: ['git', 'worktree', 'list', '--porcelain'], directory: REPOSITORY_ROOT_FOR_PROOFS }).output;
    expect(listing).not.toContain(stale.directory);
    fresh.remove();
    stale.remove();
  });
});

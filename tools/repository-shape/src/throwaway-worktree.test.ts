import { describe, expect, test } from 'vitest';
import { isOutside } from './throwaway-worktree';

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

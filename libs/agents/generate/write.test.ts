import { existsSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { applyValidPlan } from './write';
import { repositoryPath } from './repository';

const PROBE_PATH = 'libs/agents/generate/.never-written.txt';

afterEach(() => rmSync(repositoryPath(PROBE_PATH), { force: true }));

describe('applyValidPlan', () => {
  test('writes a plan with no violation', () => {
    expect(applyValidPlan({ plan: { writes: [{ path: PROBE_PATH, content: 'x' }], deletions: [], violations: [] } })).toEqual([PROBE_PATH]);
    expect(existsSync(repositoryPath(PROBE_PATH))).toBe(true);
  });

  test('leaves every file untouched when the plan holds a violation', () => {
    const plan = { writes: [{ path: PROBE_PATH, content: 'x' }], deletions: [], violations: ['an agent is invalid'] };
    expect(applyValidPlan({ plan })).toEqual([]);
    expect(existsSync(repositoryPath(PROBE_PATH))).toBe(false);
  });
});

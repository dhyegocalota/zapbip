import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { applyValidPlan } from './write';
import { repositoryPath } from './repository';

const PROBE_PATH = 'libs/agents/generate/.never-written.txt';
const DELETED_PROBE_PATH = 'libs/agents/generate/.to-delete.txt';

afterEach(() => [PROBE_PATH, DELETED_PROBE_PATH].forEach((path) => rmSync(repositoryPath(path), { force: true })));

describe('applyValidPlan', () => {
  test('writes a plan with no violation', () => {
    expect(applyValidPlan({ plan: { writes: [{ path: PROBE_PATH, content: 'x' }], deletions: [], violations: [] } })).toEqual([
      `wrote ${PROBE_PATH}`,
    ]);
    expect(existsSync(repositoryPath(PROBE_PATH))).toBe(true);
  });

  test('leaves every file untouched when the plan holds a violation', () => {
    const plan = { writes: [{ path: PROBE_PATH, content: 'x' }], deletions: [], violations: ['an agent is invalid'] };
    expect(applyValidPlan({ plan })).toEqual([]);
    expect(existsSync(repositoryPath(PROBE_PATH))).toBe(false);
  });

  test('reports a deletion as deleted and a write as wrote', () => {
    mkdirSync(dirname(repositoryPath(DELETED_PROBE_PATH)), { recursive: true });
    writeFileSync(repositoryPath(DELETED_PROBE_PATH), 'old');
    const plan = { writes: [{ path: PROBE_PATH, content: 'x' }], deletions: [DELETED_PROBE_PATH], violations: [] };
    expect(applyValidPlan({ plan })).toEqual([`wrote ${PROBE_PATH}`, `deleted ${DELETED_PROBE_PATH}`]);
    expect(existsSync(repositoryPath(DELETED_PROBE_PATH))).toBe(false);
  });
});

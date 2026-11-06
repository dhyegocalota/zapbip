import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import { WorkerSecret } from '../../src/operations/worker-secret';

const ENV_EXAMPLE_PATH = '../../.env.example';
const GITIGNORE_PATH = '../../.gitignore';
const SMOKE_NAMES = ['SMOKE_BASE_URL', 'SMOKE_CONNECTION_SECRET', 'SMOKE_OWNER_PHONE'];
const IGNORED_ENTRIES = ['.env', '.dev.vars'];

const entries: [string, string][] = readFileSync(ENV_EXAMPLE_PATH, 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  });
const gitignoreLines = readFileSync(GITIGNORE_PATH, 'utf8').split('\n');

describe('env example', () => {
  it('pin: lists exactly the worker secrets and the smoke inputs', () => {
    expect(entries.map(([name]) => name).sort()).toEqual([...Object.values(WorkerSecret), ...SMOKE_NAMES].sort());
  });

  it('pin: gives every name a non-empty placeholder value', () => {
    expect(entries.every(([, value]) => value.startsWith(PLACEHOLDER_VALUE_PREFIX) && value !== PLACEHOLDER_VALUE_PREFIX)).toBe(true);
  });

  it('pin: git ignores the real env files and not the example', () => {
    IGNORED_ENTRIES.forEach((entry) => expect(gitignoreLines).toContain(entry));
    expect(gitignoreLines).not.toContain('.env.example');
  });
});

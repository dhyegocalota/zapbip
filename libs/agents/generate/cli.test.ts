import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { repositoryPath } from './repository';

const CLI_PATH = repositoryPath('libs/agents/generate/cli.ts');
const SUMMARY_PATTERN = /^\d+ stale, \d+ deletions, \d+ violations$/m;

function checkOutputFrom(input: { workingDirectory: string }): string {
  const run = spawnSync('node', ['--import', 'tsx', CLI_PATH, 'check'], { cwd: input.workingDirectory, encoding: 'utf8' });
  return run.stdout;
}

describe('the generator command line', () => {
  test('prints the same check summary from the repository root and from apps/docs', () => {
    const fromRoot = checkOutputFrom({ workingDirectory: repositoryPath('.') });
    const fromDocs = checkOutputFrom({ workingDirectory: repositoryPath('apps/docs') });
    expect(fromRoot).toMatch(SUMMARY_PATTERN);
    expect(fromDocs).toBe(fromRoot);
  });

  test('refuses a mode it does not know with the usage line', () => {
    const run = spawnSync('node', ['--import', 'tsx', CLI_PATH, 'nope'], { cwd: repositoryPath('.'), encoding: 'utf8' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('usage: agents:<generate|check|new|mentions>');
  });
});

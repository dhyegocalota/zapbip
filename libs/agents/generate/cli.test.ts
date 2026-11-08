import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { repositoryPath } from './repository';
import { REAL_AGENT_IDS } from './test-agents';

const CLI_PATH = repositoryPath('libs/agents/generate/cli.ts');
const EXISTING_ID = REAL_AGENT_IDS.reduce((longest, id) => (id.length > longest.length ? id : longest));
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

  test('agents:new refuses an existing agent with a message and a failure code', () => {
    const run = spawnSync('node', ['--import', 'tsx', CLI_PATH, 'new', EXISTING_ID], { cwd: repositoryPath('.'), encoding: 'utf8' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(`${EXISTING_ID} already exists`);
  });

  test('agents:new refuses a call without an id', () => {
    const run = spawnSync('node', ['--import', 'tsx', CLI_PATH, 'new'], { cwd: repositoryPath('.'), encoding: 'utf8' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('usage: agents:new <id>');
  });

  test('agents:mentions lists the files that name the agent, outside its folder and the generated set', () => {
    const run = spawnSync('node', ['--import', 'tsx', CLI_PATH, 'mentions', EXISTING_ID], { cwd: repositoryPath('.'), encoding: 'utf8' });
    expect(run.status).toBe(0);
    const lines = run.stdout.split('\n').filter(Boolean);
    lines.forEach((line) => expect(line).toMatch(/^\S+:\d+$/));
    lines.forEach((line) =>
      expect(line).not.toMatch(new RegExp(`^(libs/agents/supported/${EXISTING_ID}/|libs/agents/src/generated/|docs/)`)),
    );
  });

  test('agents:mentions works from the id alone once the folder is gone and prints a message, not a stack', () => {
    const run = spawnSync('node', ['--import', 'tsx', CLI_PATH, 'mentions', 'ghost'], { cwd: repositoryPath('.'), encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stderr).toContain(
      'ghost has no folder; listing files that name its id (run agents:mentions before removing the folder to include its display names)',
    );
    expect(run.stderr).not.toContain('node:internal');
  });
});

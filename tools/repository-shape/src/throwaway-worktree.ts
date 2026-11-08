import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPOSITORY_ROOT } from './repository-files';

export const PROOF_ENVIRONMENT_VARIABLE = 'ZAPBIP_WORKTREE_PROOF';
export const IS_INSIDE_PROOF = process.env[PROOF_ENVIRONMENT_VARIABLE] !== undefined;
export const WORKTREE_PROOF_TIMEOUT_MS = 1_200_000;
export const GENERATED_PATTERNS = [
  /^libs\/agents\/src\/generated\//,
  /^apps\/docs\/(?:pt-br\/)?agents\/[a-z0-9-]+\.mdx$/,
  /^apps\/docs\/snippets\/(?:pt-br\/)?agents\//,
  /^apps\/docs\/docs\.json$/,
  /^\.github\/workflows\/verify\.yml$/,
  /^pnpm-lock\.yaml$/,
];

const MAXIMUM_BUFFER = 64 * 1024 * 1024;
const STATUS_PATH_OFFSET = 3;

export type CommandOutcome = { status: number | null; output: string };

export function run(input: { command: string[]; directory: string }): CommandOutcome {
  const [program, ...commandArguments] = input.command;
  const result = spawnSync(program as string, commandArguments, {
    cwd: input.directory,
    encoding: 'utf8',
    maxBuffer: MAXIMUM_BUFFER,
    env: { ...process.env, [PROOF_ENVIRONMENT_VARIABLE]: '1' },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

export function changedPathsOf(input: { directory: string }): string[] {
  const status = run({ command: ['git', 'status', '--porcelain', '--untracked-files=all'], directory: input.directory });
  return status.output
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(STATUS_PATH_OFFSET));
}

export function isOutside(input: { path: string; prefixes: string[] }): boolean {
  const isInsidePrefix = input.prefixes.some((prefix) => input.path.startsWith(prefix));
  const isGenerated = GENERATED_PATTERNS.some((pattern) => pattern.test(input.path));
  return !isInsidePrefix && !isGenerated;
}

export function createThrowawayWorktree(): { directory: string; remove: () => void } {
  const directory = join(mkdtempSync(join(tmpdir(), 'zapbip-worktree-')), 'tree');
  return {
    directory,
    remove: () => {
      if (IS_INSIDE_PROOF) return;
      run({ command: ['git', 'worktree', 'remove', '--force', directory], directory: REPOSITORY_ROOT });
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function checkOutHead(input: { directory: string }): CommandOutcome {
  return run({ command: ['git', 'worktree', 'add', '--detach', input.directory, 'HEAD'], directory: REPOSITORY_ROOT });
}

export const FULL_SUITES: string[][] = [
  ['pnpm', 'agents:check'],
  ['pnpm', 'typecheck'],
  ['bash', '.agents/hooks/doctor.sh'],
  ['bash', '.agents/hooks/hooks.test.sh'],
  ['pnpm', '--filter', '@zapbip/agents', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/repository-shape', 'test:unit'],
  ['pnpm', '--filter', 'zapbip', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/api', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/api', 'test:integration'],
];
const OUTPUT_TAIL_LENGTH = 3000;

export function failuresOf(input: { suites: string[][]; directory: string }): string[] {
  return input.suites
    .map((command) => ({ command: command.join(' '), ...run({ command, directory: input.directory }) }))
    .filter((suite) => suite.status !== 0)
    .map((suite) => `${suite.command}\n${suite.output.slice(-OUTPUT_TAIL_LENGTH)}`);
}

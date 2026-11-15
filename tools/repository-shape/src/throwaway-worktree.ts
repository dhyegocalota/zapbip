import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DOCS_LANGUAGE_FOLDERS } from '@zapbip/types';
import { REPOSITORY_ROOT } from './repository-files';

export const REPOSITORY_ROOT_FOR_PROOFS = REPOSITORY_ROOT;
export const PROOF_ENVIRONMENT_VARIABLE = 'ZAPBIP_WORKTREE_PROOF';
export const IS_INSIDE_PROOF = process.env[PROOF_ENVIRONMENT_VARIABLE] !== undefined;
export const WORKTREE_PROOF_TIMEOUT_MS = 1_200_000;
const TRANSLATED_DOCS_FOLDERS = Object.values(DOCS_LANGUAGE_FOLDERS).filter(Boolean).join('|');
export const GENERATED_PATTERNS = [
  /^libs\/agents\/src\/generated\//,
  new RegExp(`^apps/docs/(?:(?:${TRANSLATED_DOCS_FOLDERS})/)?agents/[a-z0-9-]+\\.mdx$`),
  new RegExp(`^apps/docs/snippets/(?:(?:${TRANSLATED_DOCS_FOLDERS})/)?agents/`),
  /^apps\/docs\/docs\.json$/,
  /^(?:README\.md|apps\/README\.md)$/,
  /^\.github\/workflows\/verify\.yml$/,
];

const MAXIMUM_BUFFER = 64 * 1024 * 1024;
const STATUS_PATH_OFFSET = 3;

export type CommandOutcome = { status: number | null; output: string };

export enum LockfileMode {
  Frozen = '--frozen-lockfile',
  Resolve = '--no-frozen-lockfile',
}

const LOCKFILE_INSTALL_FLAGS: Record<LockfileMode, string[]> = {
  [LockfileMode.Frozen]: [LockfileMode.Frozen, '--offline'],
  [LockfileMode.Resolve]: [LockfileMode.Resolve, '--prefer-offline'],
};

const COLD_METADATA_CACHE_FOLDER = 'pnpm-metadata-cache';

export function run(input: { command: string[]; directory: string; environment?: Record<string, string> }): CommandOutcome {
  const [program, ...commandArguments] = input.command;
  const result = spawnSync(program as string, commandArguments, {
    cwd: input.directory,
    encoding: 'utf8',
    maxBuffer: MAXIMUM_BUFFER,
    env: { ...process.env, [PROOF_ENVIRONMENT_VARIABLE]: '1', ...input.environment },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

export function installDependencies(input: { directory: string; lockfile: LockfileMode }): CommandOutcome {
  return run({
    command: ['pnpm', 'install', ...LOCKFILE_INSTALL_FLAGS[input.lockfile]],
    directory: input.directory,
    environment: { CI: 'true', npm_config_cache_dir: join(dirname(input.directory), COLD_METADATA_CACHE_FOLDER) },
  });
}

export function changedPathsOf(input: { directory: string }): string[] {
  const status = run({ command: ['git', 'status', '--porcelain', '--untracked-files=all'], directory: input.directory });
  return status.output
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(STATUS_PATH_OFFSET));
}

const LOCKFILE = 'pnpm-lock.yaml';
const APPLICATIONS_PREFIX = 'apps/';

export function isOutside(input: { path: string; prefixes: string[] }): boolean {
  const isInsidePrefix = input.prefixes.some((prefix) => input.path.startsWith(prefix));
  const isGenerated = GENERATED_PATTERNS.some((pattern) => pattern.test(input.path));
  const followsPluginPackage = input.path === LOCKFILE && input.prefixes.some((prefix) => prefix.startsWith(APPLICATIONS_PREFIX));
  return !isInsidePrefix && !isGenerated && !followsPluginPackage;
}

export function createThrowawayWorktree(): { directory: string; remove: () => void } {
  const parent = mkdtempSync(join(tmpdir(), 'zapbip-worktree-'));
  const directory = join(parent, 'tree');
  return {
    directory,
    remove: () => {
      if (IS_INSIDE_PROOF) return;
      run({ command: ['git', 'worktree', 'remove', '--force', directory], directory: REPOSITORY_ROOT });
      rmSync(parent, { recursive: true, force: true });
    },
  };
}

export function checkOutHead(input: { directory: string }): CommandOutcome {
  run({ command: ['git', 'worktree', 'prune'], directory: REPOSITORY_ROOT });
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

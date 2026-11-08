import { boundaryViolationsOf } from '../src/checks/boundaries';
import {
  leakViolationsOf,
  withoutAgentNavigationLists,
  withoutGeneratedWorkflowRegions,
  type LeakAgent,
  type LeakFile,
} from '../src/checks/leaks';
import type { AgentConnectorRuntime, AgentDefinition } from '../src/contract';

export type ScannedAgent = { id: string; definition: AgentDefinition; runtime: AgentConnectorRuntime | null };

const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.sh', '.py', '.yml', '.yaml', '.toml', '.json'];
const GENERATED_FOLDER = 'libs/agents/src/generated/';
const WORKFLOW_FILE = '.github/workflows/verify.yml';
const NAVIGATION_FILE = 'apps/docs/docs.json';
const HARNESS_FOLDERS = ['.claude/', '.codex/'];
const HARNESS_LITERAL_EXEMPT_FILES = ['.agents/hooks/doctor.sh', '.agents/hooks/remind-docs.sh'];
const FULLY_EXEMPT_FILES = [
  '.agents/hooks/hooks.test.sh',
  '.agents/skills/brainstorming/scripts/start-server.sh',
  '.agents/skills/brainstorming/scripts/server.cjs',
  'pnpm-lock.yaml',
  'libs/agents/src/checks/leaks.test.ts',
  'libs/agents/generate/leak-scan.ts',
  'tools/repository-shape/src/agent-registry.test.ts',
  ...['agent-surfaces', 'delivery-docs', 'rules', 'scenarios'].map((name) => `tools/repository-shape/src/${name}.test.ts`),
];

function leakAgentOf(input: { agent: ScannedAgent }): LeakAgent {
  const { id, definition, runtime } = input.agent;
  return {
    id,
    enumMember: definition.enumMember,
    isOrdinaryWord: definition.idIsOrdinaryWord,
    literals: runtime === null ? [] : [runtime.homeFolder, runtime.homeVariable],
  };
}

function scannedTextOf(input: { file: LeakFile }): string {
  if (input.file.path === WORKFLOW_FILE) return withoutGeneratedWorkflowRegions({ text: input.file.text });
  if (input.file.path === NAVIGATION_FILE) return withoutAgentNavigationLists({ text: input.file.text });
  return input.file.text;
}

export function treeLeakViolationsOf(input: { agents: ScannedAgent[]; files: LeakFile[] }): string[] {
  const files = input.files
    .filter((file) => SCANNED_EXTENSIONS.some((extension) => file.path.endsWith(extension)))
    .map((file) => ({ path: file.path, text: scannedTextOf({ file }) }));
  return leakViolationsOf({
    agents: input.agents.map((agent) => leakAgentOf({ agent })),
    files,
    allowedPrefixes: [GENERATED_FOLDER, ...FULLY_EXEMPT_FILES, ...HARNESS_FOLDERS],
    literalExemptPrefixes: HARNESS_LITERAL_EXEMPT_FILES,
  });
}

export function treeBoundaryViolationsOf(input: { files: LeakFile[] }): string[] {
  return boundaryViolationsOf({
    files: input.files.filter((file) => SCANNED_EXTENSIONS.some((extension) => file.path.endsWith(extension))),
  });
}

import { GenerationMode, applyValidPlan, pendingDeletionsOf, staleWritesOf, writePlan } from './write';
import { existsSync, readFileSync } from 'node:fs';
import { DocsLanguage } from '@zapbip/types';
import { AgentFacet, type AgentDefinition } from '../src/contract';
import { discoverAgents } from './discover';
import { loadAgent } from './load';
import { registryCheckViolationsOf } from './registry-checks';
import { repositoryPath } from './repository';
import { planGeneratedFiles, type GenerationPlan } from './plan';
import { SUPPORTED_FOLDER } from './repository';
import { mentionsOf } from './mentions';
import { GENERATED_FOLDER } from './paths';
import { ScaffoldKind, scaffoldFilesOf } from './scaffold';
import { UnreadableTrackedFileError, listSource, listTree, readSource, trackedTextFiles } from './source';

enum CliMode {
  Generate = 'generate',
  Check = 'check',
  New = 'new',
  Mentions = 'mentions',
}

type CliHandler = (input: { argv: string[] }) => Promise<number>;

const FAILURE_EXIT_CODE = 1;
const SUCCESS_EXIT_CODE = 0;
const PLUGIN_FOLDER_SUFFIX = '-plugin';
const RECORD_PREFIXES = ['docs/', 'pnpm-lock.yaml'];
const NEXT_STEP_HINT = 'edit the names and the copy, then run pnpm agents:generate';

async function planFromDisk(): Promise<GenerationPlan> {
  return planGeneratedFiles({ agents: discoverAgents({ roots: [SUPPORTED_FOLDER] }), readSource, listSource });
}

async function registryCheckViolations(): Promise<string[]> {
  const loaded = await Promise.all(discoverAgents({ roots: [SUPPORTED_FOLDER] }).map((agent) => loadAgent({ agent })));
  const agents = loaded.map((agent) => ({
    ...agent,
    guides: {
      [DocsLanguage.English]: agent.facets.includes(AgentFacet.EnglishPage) ? readSource(`${agent.folder}/${AgentFacet.EnglishPage}`) : '',
      [DocsLanguage.PortugueseBrazil]: agent.facets.includes(AgentFacet.PortuguesePage)
        ? readSource(`${agent.folder}/${AgentFacet.PortuguesePage}`)
        : '',
    },
  }));
  const hostedFilenames = agents.flatMap((agent) =>
    agent.plugin === null ? [] : agent.plugin.hostedArtifacts.map((artifact) => artifact.filename),
  );
  const sources = {
    applicationPluginFolders: listSource('apps')
      .filter((name) => name.endsWith(PLUGIN_FOLDER_SUFFIX))
      .map((name) => `apps/${name}`),
    readFile: (path: string) => (existsSync(repositoryPath(path)) ? readFileSync(repositoryPath(path)) : null),
    servedFilenames: hostedFilenames,
  };
  try {
    return registryCheckViolationsOf({ agents, files: trackedTextFiles(), sources });
  } catch (error) {
    if (error instanceof UnreadableTrackedFileError) return [error.message];
    throw error;
  }
}

async function generate(): Promise<number> {
  const plan = await planFromDisk();
  const violations = [...plan.violations, ...(await registryCheckViolations())];
  violations.forEach((violation) => console.error(violation));
  if (violations.length > 0) return FAILURE_EXIT_CODE;
  applyValidPlan({ plan }).forEach((report) => console.log(report));
  return SUCCESS_EXIT_CODE;
}

async function check(): Promise<number> {
  const plan = await planFromDisk();
  const violations = [...plan.violations, ...(await registryCheckViolations())];
  writePlan({ plan, mode: GenerationMode.Check }).forEach((problem) => console.log(problem));
  violations.forEach((violation) => console.log(violation));
  const counts = [staleWritesOf({ plan }).length, pendingDeletionsOf({ plan }).length, violations.length];
  console.log(`${counts[0]} stale, ${counts[1]} deletions, ${counts[2]} violations`);
  return counts.every((count) => count === 0) ? SUCCESS_EXIT_CODE : FAILURE_EXIT_CODE;
}

function agentIdOf(input: { mode: CliMode; argv: string[] }): string {
  const [id] = input.argv;
  if (!id) throw new Error(`usage: agents:${input.mode} <id>`);
  return id;
}

const KIND_FLAGS: Record<string, ScaffoldKind> = {
  '--connector': ScaffoldKind.Connector,
  '--plugin': ScaffoldKind.Plugin,
};

function scaffoldKindOf(input: { argv: string[] }): ScaffoldKind {
  const [, flag] = input.argv;
  if (flag === undefined) return ScaffoldKind.Install;
  if (!Object.hasOwn(KIND_FLAGS, flag)) throw new Error(`usage: agents:new <id> [${Object.keys(KIND_FLAGS).join('|')}]`);
  return KIND_FLAGS[flag] as ScaffoldKind;
}

async function scaffold(input: { argv: string[] }): Promise<number> {
  const id = agentIdOf({ mode: CliMode.New, argv: input.argv });
  const existingIds = discoverAgents({ roots: [SUPPORTED_FOLDER] }).map((agent) => agent.id);
  const kind = scaffoldKindOf({ argv: input.argv });
  const writes = scaffoldFilesOf({ id, kind, existingIds, readSource, listTree });
  writePlan({ plan: { writes, deletions: [], violations: [] }, mode: GenerationMode.Write }).forEach((path) =>
    console.log(`wrote ${path}`),
  );
  console.log(NEXT_STEP_HINT);
  return SUCCESS_EXIT_CODE;
}

function namesOf(input: { id: string; definition: AgentDefinition | null }): string[] {
  if (input.definition === null) return [input.id];
  const { matrixName, linkName, speakerNames } = input.definition.docs;
  return [...new Set([input.id, ...Object.values(matrixName), ...Object.values(linkName), ...speakerNames])];
}

async function mentions(input: { argv: string[] }): Promise<number> {
  const id = agentIdOf({ mode: CliMode.Mentions, argv: input.argv });
  const agent = discoverAgents({ roots: [SUPPORTED_FOLDER] }).find((candidate) => candidate.id === id);
  if (!agent)
    console.error(
      `${id} has no folder; listing files that name its id (run agents:mentions before removing the folder to include its display names)`,
    );
  const definition = agent ? (await loadAgent({ agent })).definition : null;
  if (agent && !definition) throw new Error(`${id} has no definition`);
  const plan = await planFromDisk();
  const excludedPrefixes = [
    `${SUPPORTED_FOLDER}/${id}/`,
    `${GENERATED_FOLDER}/`,
    ...RECORD_PREFIXES,
    ...plan.writes.map((write) => write.path),
  ];
  mentionsOf({ names: namesOf({ id, definition }), files: trackedTextFiles(), excludedPrefixes }).forEach((mention) =>
    console.log(mention),
  );
  return SUCCESS_EXIT_CODE;
}

const HANDLERS: Record<CliMode, CliHandler> = {
  [CliMode.Generate]: generate,
  [CliMode.Check]: check,
  [CliMode.New]: scaffold,
  [CliMode.Mentions]: mentions,
};

export async function runCli(input: { mode: string; argv: string[] }): Promise<void> {
  const handler = HANDLERS[input.mode as CliMode];
  if (!handler) throw new Error(`usage: agents:<${Object.values(CliMode).join('|')}>`);
  process.exitCode = await handler({ argv: input.argv });
}

await runCli({ mode: process.argv[2] as string, argv: process.argv.slice(3) });

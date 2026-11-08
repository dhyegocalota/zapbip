import { posix } from 'node:path';

export type BoundaryFile = { path: string; text: string };

type BoundaryRule = {
  name: string;
  message: string;
  appliesTo: (input: { path: string }) => boolean;
  forbids: (input: { path: string; specifier: string }) => boolean;
};

const SPECIFIER_PATTERN = /(?:from|import\s*\()\s*['"]([^'"]+)['"]/g;
const AGENTS_PACKAGE = '@zapbip/agents';
const WORKER_FACETS = [`${AGENTS_PACKAGE}/install`, `${AGENTS_PACKAGE}/plugins`];
const SUPPORTED_ROOT = 'libs/agents/supported';
const WORKER_FACET_FILES = ['definition.ts', 'install.ts', 'install-copy.ts', 'plugin.ts'];
const NODE_PREFIX = 'node:';
const AGENT_ENUM_PATTERN = /export enum (AgentId|InstallClient|ConnectorClient|DocsOnlyClient|ChannelPluginProduct)\b/g;
const SHARED_LIBRARY_ROOTS = ['libs/core/', 'libs/types/'];
const WORKER_SOURCE_ROOT = 'apps/api/src/';
const TYPES_SOURCE_ROOT = 'libs/types/src/';

function agentFolderOf(input: { path: string }): string | null {
  const [id] = posix.relative(SUPPORTED_ROOT, input.path).split('/');
  return input.path.startsWith(`${SUPPORTED_ROOT}/`) && id ? `${SUPPORTED_ROOT}/${id}` : null;
}

function importsOtherFolder(input: { path: string; specifier: string }): boolean {
  const ownFolder = agentFolderOf({ path: input.path });
  if (!input.specifier.startsWith('.')) return false;
  const target = posix.join(posix.dirname(input.path), input.specifier);
  const targetFolder = agentFolderOf({ path: target });
  const isOtherAgent = targetFolder !== null && targetFolder !== ownFolder;
  return isOtherAgent || target.startsWith('apps/');
}

const RULES: BoundaryRule[] = [
  {
    name: 'B1',
    message: 'the shared libraries import no agents package',
    appliesTo: ({ path }) => SHARED_LIBRARY_ROOTS.some((root) => path.startsWith(root)),
    forbids: ({ specifier }) => specifier.startsWith(AGENTS_PACKAGE),
  },
  {
    name: 'B2',
    message: 'an agent folder imports no other agent folder or app',
    appliesTo: ({ path }) => agentFolderOf({ path }) !== null,
    forbids: importsOtherFolder,
  },
  {
    name: 'B3',
    message: 'this facet runs in the Worker and imports no node module',
    appliesTo: ({ path }) => agentFolderOf({ path }) !== null && WORKER_FACET_FILES.includes(posix.basename(path)),
    forbids: ({ specifier }) => specifier.startsWith(NODE_PREFIX),
  },
  {
    name: 'B4',
    message: 'the Worker imports only the install and plugins facets',
    appliesTo: ({ path }) => path.startsWith(WORKER_SOURCE_ROOT),
    forbids: ({ specifier }) => specifier.startsWith(AGENTS_PACKAGE) && !WORKER_FACETS.includes(specifier),
  },
];

function specifiersOf(input: { text: string }): string[] {
  return [...input.text.matchAll(SPECIFIER_PATTERN)].map((match) => match[1] as string);
}

function importViolationsOf(input: { file: BoundaryFile }): string[] {
  const { path, text } = input.file;
  const rules = RULES.filter((rule) => rule.appliesTo({ path }));
  return specifiersOf({ text }).flatMap((specifier) =>
    rules.filter((rule) => rule.forbids({ path, specifier })).map((rule) => `${path}: ${rule.name} ${rule.message} (${specifier})`),
  );
}

function agentEnumViolationsOf(input: { file: BoundaryFile }): string[] {
  if (!input.file.path.startsWith(TYPES_SOURCE_ROOT)) return [];
  return [...input.file.text.matchAll(AGENT_ENUM_PATTERN)].map(
    (match) => `${input.file.path}: B7 the shared types declare no agent enum (${match[1]})`,
  );
}

export function boundaryViolationsOf(input: { files: BoundaryFile[] }): string[] {
  return input.files.flatMap((file) => [...importViolationsOf({ file }), ...agentEnumViolationsOf({ file })]);
}

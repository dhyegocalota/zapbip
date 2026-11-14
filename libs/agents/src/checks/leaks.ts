import { AGENTS_GROUP_INDEX, DOCS_GROUPS } from '../docs';
import { constantNameOf } from '../identifiers';

export type LeakAgent = { id: string; enumMember: string; isOrdinaryWord: boolean; literals: string[] };
export type LeakFile = { path: string; text: string };

const AGENT_ENUM_NAMES = ['AgentId', 'InstallClient', 'ConnectorClient', 'PluginAgent', 'WakeAgent', 'ChannelAgent'];
const WHOLE_ENUM_RECORD_PATTERN = new RegExp(`\\bRecord<(${AGENT_ENUM_NAMES.join('|')})\\b`);
const LINE_SEPARATOR = '\n';
const SUPPORTED_ROOT = 'libs/agents/supported';

const REGULAR_EXPRESSION_SPECIALS = /[.*+?^${}()|[\]\\]/g;

function escapedOf(input: { text: string }): string {
  return input.text.replace(REGULAR_EXPRESSION_SPECIALS, '\\$&');
}

function ownedPrefixesOf(input: { agent: LeakAgent }): string[] {
  return [`${SUPPORTED_ROOT}/${input.agent.id}/`, `apps/${input.agent.id}-plugin/`];
}

function namingPatternOf(input: { agent: LeakAgent; includeLiterals: boolean }): RegExp {
  const { agent } = input;
  const id = escapedOf({ text: agent.id });
  const memberReference = `\\b(?:${AGENT_ENUM_NAMES.join('|')})\\.${agent.enumMember}\\b`;
  const folderReference = `supported/${id}(?![\\w-])`;
  const quotedIdReference = `(['"\`])${id}\\1`;
  const quotedIdPrefixReference = `['"\`]${id}[-._]`;
  const bareIdReference = `(?<![A-Za-z0-9])(?<!developers/)${id}(?![A-Za-z0-9])`;
  const idReferences = agent.isOrdinaryWord ? [quotedIdReference, quotedIdPrefixReference] : [bareIdReference];
  const productWordReference = `${escapedOf({ text: agent.enumMember })}(?![a-z])`;
  const pluginFolderReference = `apps/${id}-plugin`;
  const constantWord = constantNameOf({ id: agent.id });
  const constantReference = `(?<![A-Z0-9])${escapedOf({ text: constantWord })}(?![A-Z0-9])`;
  const literals = input.includeLiterals ? agent.literals : [];
  const literalReferences = literals.map((literal) => `(?<![\\w])${escapedOf({ text: literal })}(?![\\w])`);
  return new RegExp(
    [
      memberReference,
      folderReference,
      ...idReferences,
      productWordReference,
      pluginFolderReference,
      constantReference,
      ...literalReferences,
    ].join('|'),
  );
}

function agentLeaksIn(input: { agent: LeakAgent; file: LeakFile; includeLiterals: boolean }): string[] {
  const pattern = namingPatternOf({ agent: input.agent, includeLiterals: input.includeLiterals });
  return input.file.text
    .split(LINE_SEPARATOR)
    .flatMap((line, index) => (pattern.test(line) ? [`${input.file.path}:${index + 1} names ${input.agent.id}`] : []));
}

function wholeEnumRecordLeaksIn(input: { file: LeakFile }): string[] {
  return input.file.text.split(LINE_SEPARATOR).flatMap((line, index) => {
    const enumName = WHOLE_ENUM_RECORD_PATTERN.exec(line)?.[1];
    return enumName ? [`${input.file.path}:${index + 1} keys a record by ${enumName}`] : [];
  });
}

const WORKFLOW_REGION_PATTERN = /^ *# NB ADR 0033: generated [^\n]* begin\n[\s\S]*?^ *# NB ADR 0033: generated [^\n]* end\n?/gm;
const NAVIGATION_AGENT_GROUPS = Object.values(DOCS_GROUPS).map((groups) => groups[AGENTS_GROUP_INDEX]);
const JSON_INDENT = 2;

type NavigationGroup = { group?: string; pages?: unknown[] };
type NavigationConfig = { navigation?: { languages?: { groups?: NavigationGroup[] }[] } };

export function withoutGeneratedWorkflowRegions(input: { text: string }): string {
  return input.text.replace(WORKFLOW_REGION_PATTERN, '').replace(/\n$/, '');
}

export function withoutAgentNavigationLists(input: { text: string }): string {
  const config = JSON.parse(input.text) as NavigationConfig;
  const languages = config.navigation?.languages;
  if (!languages) return input.text;
  const groups = languages.flatMap((language) => (language.groups ? language.groups : []));
  groups.filter((group) => NAVIGATION_AGENT_GROUPS.includes(group.group as string)).forEach((group) => (group.pages = []));
  return JSON.stringify(config, null, JSON_INDENT);
}

export function leakViolationsOf(input: {
  agents: LeakAgent[];
  files: LeakFile[];
  allowedPrefixes: string[];
  literalExemptPrefixes: string[];
}): string[] {
  const checkedFiles = input.files.filter((file) => !input.allowedPrefixes.some((prefix) => file.path.startsWith(prefix)));
  return checkedFiles.flatMap((file) => [
    ...wholeEnumRecordLeaksIn({ file }),
    ...input.agents
      .filter((agent) => !ownedPrefixesOf({ agent }).some((prefix) => file.path.startsWith(prefix)))
      .flatMap((agent) =>
        agentLeaksIn({ agent, file, includeLiterals: !input.literalExemptPrefixes.some((prefix) => file.path.startsWith(prefix)) }),
      ),
  ]);
}

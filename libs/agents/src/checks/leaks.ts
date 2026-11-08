export type LeakAgent = { id: string; enumMember: string; literals: string[] };
export type LeakFile = { path: string; text: string };

const AGENT_ENUM_NAMES = ['AgentId', 'InstallClient', 'ConnectorClient', 'PluginAgent'];
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

function namingPatternOf(input: { agent: LeakAgent }): RegExp {
  const memberReference = `\\b(?:${AGENT_ENUM_NAMES.join('|')})\\.${input.agent.enumMember}\\b`;
  const folderReference = `supported/${input.agent.id}(?![\\w-])`;
  const literalReferences = input.agent.literals.map((literal) => `(?<![\\w])${escapedOf({ text: literal })}(?![\\w])`);
  return new RegExp([memberReference, folderReference, ...literalReferences].join('|'));
}

function agentLeaksIn(input: { agent: LeakAgent; file: LeakFile }): string[] {
  const pattern = namingPatternOf({ agent: input.agent });
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

export function leakViolationsOf(input: { agents: LeakAgent[]; files: LeakFile[]; allowedPrefixes: string[] }): string[] {
  const checkedFiles = input.files.filter((file) => !input.allowedPrefixes.some((prefix) => file.path.startsWith(prefix)));
  return checkedFiles.flatMap((file) => [
    ...wholeEnumRecordLeaksIn({ file }),
    ...input.agents
      .filter((agent) => !ownedPrefixesOf({ agent }).some((prefix) => file.path.startsWith(prefix)))
      .flatMap((agent) => agentLeaksIn({ agent, file })),
  ]);
}

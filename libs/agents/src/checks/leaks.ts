export type LeakAgent = { id: string; enumMember: string };
export type LeakFile = { path: string; text: string };

const AGENT_ENUM_NAMES = ['AgentId', 'InstallClient', 'ConnectorClient', 'PluginAgent'];
const LINE_SEPARATOR = '\n';
const SUPPORTED_ROOT = 'libs/agents/supported';

function ownedPrefixesOf(input: { agent: LeakAgent }): string[] {
  return [`${SUPPORTED_ROOT}/${input.agent.id}/`, `apps/${input.agent.id}-plugin/`];
}

function namingPatternOf(input: { agent: LeakAgent }): RegExp {
  const memberReference = `\\b(?:${AGENT_ENUM_NAMES.join('|')})\\.${input.agent.enumMember}\\b`;
  const folderReference = `supported/${input.agent.id}(?![\\w-])`;
  return new RegExp(`${memberReference}|${folderReference}`);
}

function agentLeaksIn(input: { agent: LeakAgent; file: LeakFile }): string[] {
  const pattern = namingPatternOf({ agent: input.agent });
  return input.file.text
    .split(LINE_SEPARATOR)
    .flatMap((line, index) => (pattern.test(line) ? [`${input.file.path}:${index + 1} names ${input.agent.id}`] : []));
}

export function leakViolationsOf(input: { agents: LeakAgent[]; files: LeakFile[]; allowedPrefixes: string[] }): string[] {
  const checkedFiles = input.files.filter((file) => !input.allowedPrefixes.some((prefix) => file.path.startsWith(prefix)));
  return checkedFiles.flatMap((file) =>
    input.agents
      .filter((agent) => !ownedPrefixesOf({ agent }).some((prefix) => file.path.startsWith(prefix)))
      .flatMap((agent) => agentLeaksIn({ agent, file })),
  );
}

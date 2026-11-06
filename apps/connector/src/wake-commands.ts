import {
  CODEX_ALLOWED_TOOL_NAME,
  CODEX_APPROVAL_MODE,
  CODEX_ACTIVE_WRITER_MESSAGE,
  CODEX_ZAPBIP_SERVER_NAME,
  CLAUDE_PERMISSION_MODE,
  STDIN_PROMPT_ARGUMENT,
  ConnectorClient,
  UUID_PATTERN,
  WAKE_ALLOWED_TOOL,
} from '@zapbip/types';

type ResumeArgumentBuilder = (input: { sessionId: string; isolationArguments: string[] }) => string[];

const CODEX_SERVER_CONFIGURATION_PREFIX = `mcp_servers.${CODEX_ZAPBIP_SERVER_NAME}`;
const CLAUDE_SAFETY_ARGUMENTS = ['--permission-mode', CLAUDE_PERMISSION_MODE, '--tools='];
const CODEX_SAFETY_ARGUMENTS = [
  'exec',
  '--skip-git-repo-check',
  '-s',
  'read-only',
  '-c',
  `${CODEX_SERVER_CONFIGURATION_PREFIX}.default_tools_approval_mode="${CODEX_APPROVAL_MODE}"`,
  '-c',
  `${CODEX_SERVER_CONFIGURATION_PREFIX}.enabled_tools=["${CODEX_ALLOWED_TOOL_NAME}"]`,
];

export const CLIENT_BINARY_NAME: Record<ConnectorClient, string> = {
  [ConnectorClient.ClaudeCode]: 'claude',
  [ConnectorClient.Codex]: 'codex',
};

function assertSessionId(input: { sessionId: string }): void {
  if (!UUID_PATTERN.test(input.sessionId)) throw new Error('session id is not a UUID');
}

export const RESUME_ARGUMENT_BUILDERS: Record<ConnectorClient, ResumeArgumentBuilder> = {
  [ConnectorClient.ClaudeCode]: ({ sessionId, isolationArguments }) => {
    assertSessionId({ sessionId });
    return ['-p', '--resume', sessionId, ...CLAUDE_SAFETY_ARGUMENTS, ...isolationArguments, `--allowedTools=${WAKE_ALLOWED_TOOL}`];
  },
  [ConnectorClient.Codex]: ({ sessionId, isolationArguments }) => {
    assertSessionId({ sessionId });
    return [...CODEX_SAFETY_ARGUMENTS, ...isolationArguments, 'resume', sessionId, STDIN_PROMPT_ARGUMENT];
  },
};

export function buildCodexNewSessionArguments(input: { isolationArguments: string[] }): string[] {
  return [...CODEX_SAFETY_ARGUMENTS, ...input.isolationArguments, STDIN_PROMPT_ARGUMENT];
}

export function isActiveWriterRefusal(input: { stderrText: string }): boolean {
  return input.stderrText.includes(CODEX_ACTIVE_WRITER_MESSAGE);
}

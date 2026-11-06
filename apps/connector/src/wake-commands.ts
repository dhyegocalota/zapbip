import {
  CODEX_ALLOWED_TOOL_NAME,
  CODEX_APPROVAL_MODE,
  CODEX_ACTIVE_WRITER_MESSAGE,
  CODEX_ZAPBIP_SERVER_NAME,
  ConnectorClient,
  UUID_PATTERN,
  WAKE_ALLOWED_TOOL,
} from '@zapbip/types';

type ResumeArgumentBuilder = (input: { sessionId: string; prompt: string }) => string[];

const CODEX_SERVER_CONFIGURATION_PREFIX = `mcp_servers.${CODEX_ZAPBIP_SERVER_NAME}`;
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
  [ConnectorClient.ClaudeCode]: ({ sessionId, prompt }) => {
    assertSessionId({ sessionId });
    return ['-p', '--resume', sessionId, `--allowedTools=${WAKE_ALLOWED_TOOL}`, prompt];
  },
  [ConnectorClient.Codex]: ({ sessionId, prompt }) => {
    assertSessionId({ sessionId });
    return [...CODEX_SAFETY_ARGUMENTS, 'resume', sessionId, prompt];
  },
};

export function buildCodexNewSessionArguments(input: { prompt: string }): string[] {
  return [...CODEX_SAFETY_ARGUMENTS, input.prompt];
}

export function isActiveWriterRefusal(input: { stderrText: string }): boolean {
  return input.stderrText.includes(CODEX_ACTIVE_WRITER_MESSAGE);
}

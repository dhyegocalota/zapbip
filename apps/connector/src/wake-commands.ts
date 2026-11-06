import { ConnectorClient } from '@zapbip/types';

type ResumeArgumentBuilder = (input: { sessionId: string; prompt: string }) => string[];

export const CLIENT_BINARY_NAME: Record<ConnectorClient, string> = {
  [ConnectorClient.ClaudeCode]: 'claude',
  [ConnectorClient.Codex]: 'codex',
};

export const RESUME_ARGUMENT_BUILDERS: Record<ConnectorClient, ResumeArgumentBuilder> = {
  [ConnectorClient.ClaudeCode]: (input) => {
    void input;
    throw new Error('claudeResumeArguments is not implemented');
  },
  [ConnectorClient.Codex]: (input) => {
    void input;
    throw new Error('codexResumeArguments is not implemented');
  },
};

export function buildCodexNewSessionArguments(input: { prompt: string }): string[] {
  void input;
  throw new Error('buildCodexNewSessionArguments is not implemented');
}

export function isActiveWriterRefusal(input: { stderrText: string }): boolean {
  void input;
  throw new Error('isActiveWriterRefusal is not implemented');
}

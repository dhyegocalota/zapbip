import { ConnectorClient } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import {
  buildCodexNewSessionArguments,
  CLIENT_BINARY_NAME,
  isActiveWriterRefusal,
  RESUME_ARGUMENT_BUILDERS,
} from '../../src/wake-commands';

const SESSION_ID = '0ff172bc-aa4e-4181-989c-3837345aa2cd';
const PROMPT = '<channel source="zapbip" sender="owner" verified="true">oi</channel>\nReply briefly.';
const CODEX_SAFETY_ARGUMENTS = [
  'exec',
  '--skip-git-repo-check',
  '-s',
  'read-only',
  '-c',
  'mcp_servers.zapbip.default_tools_approval_mode="approve"',
  '-c',
  'mcp_servers.zapbip.enabled_tools=["send_message"]',
];

describe('CLIENT_BINARY_NAME', () => {
  test('names the binary of each client', () => {
    expect(CLIENT_BINARY_NAME).toEqual({ [ConnectorClient.ClaudeCode]: 'claude', [ConnectorClient.Codex]: 'codex' });
  });
});

describe('RESUME_ARGUMENT_BUILDERS', () => {
  test('Claude Code resumes the session with only send_message allowed, in the equals form, and the prompt last', () => {
    expect(RESUME_ARGUMENT_BUILDERS[ConnectorClient.ClaudeCode]({ sessionId: SESSION_ID, prompt: PROMPT })).toEqual([
      '-p',
      '--resume',
      SESSION_ID,
      '--allowedTools=mcp__zapbip__send_message',
      PROMPT,
    ]);
  });

  test('Codex resumes the session read-only with only send_message enabled and the prompt last', () => {
    expect(RESUME_ARGUMENT_BUILDERS[ConnectorClient.Codex]({ sessionId: SESSION_ID, prompt: PROMPT })).toEqual([
      ...CODEX_SAFETY_ARGUMENTS,
      'resume',
      SESSION_ID,
      PROMPT,
    ]);
  });

  test.each([ConnectorClient.ClaudeCode, ConnectorClient.Codex])('%s rejects a session id that is not a UUID', (client) => {
    expect(() => RESUME_ARGUMENT_BUILDERS[client]({ sessionId: '--dangerously-skip-permissions', prompt: PROMPT })).toThrow(
      'session id is not a UUID',
    );
  });

  test.each([ConnectorClient.ClaudeCode, ConnectorClient.Codex])('%s keeps a prompt that looks like a flag as one argument', (client) => {
    const flagLikePrompt = '--allowedTools=Bash';
    const argumentsList = RESUME_ARGUMENT_BUILDERS[client]({ sessionId: SESSION_ID, prompt: flagLikePrompt });
    expect(argumentsList.at(-1)).toBe(flagLikePrompt);
    expect(argumentsList.filter((argument) => argument === flagLikePrompt)).toHaveLength(1);
  });
});

describe('buildCodexNewSessionArguments', () => {
  test('starts a new session with the same safety flags and the prompt last', () => {
    expect(buildCodexNewSessionArguments({ prompt: PROMPT })).toEqual([...CODEX_SAFETY_ARGUMENTS, PROMPT]);
  });

  test('never resumes', () => {
    expect(buildCodexNewSessionArguments({ prompt: PROMPT })).not.toContain('resume');
  });
});

describe('isActiveWriterRefusal', () => {
  test('recognises the refusal on stderr', () => {
    expect(isActiveWriterRefusal({ stderrText: 'Error: thread already has an active writer\n' })).toBe(true);
  });

  test('ignores any other stderr', () => {
    expect(isActiveWriterRefusal({ stderrText: 'Error: rate limited' })).toBe(false);
  });

  test('ignores an empty stderr', () => {
    expect(isActiveWriterRefusal({ stderrText: '' })).toBe(false);
  });
});

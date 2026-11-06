import { ConnectorClient } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import {
  buildCodexNewSessionArguments,
  CLIENT_BINARY_NAME,
  isActiveWriterRefusal,
  RESUME_ARGUMENT_BUILDERS,
} from '../../src/wake-commands';

const SESSION_ID = '0ff172bc-aa4e-4181-989c-3837345aa2cd';
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
  test('Claude Code resumes the session in dontAsk mode with every built-in tool off and only send_message allowed', () => {
    expect(RESUME_ARGUMENT_BUILDERS[ConnectorClient.ClaudeCode]({ sessionId: SESSION_ID })).toEqual([
      '-p',
      '--resume',
      SESSION_ID,
      '--permission-mode',
      'dontAsk',
      '--tools=',
      '--allowedTools=mcp__zapbip__send_message',
    ]);
  });

  test('Codex resumes the session read-only with only send_message enabled and reads the prompt from standard input', () => {
    expect(RESUME_ARGUMENT_BUILDERS[ConnectorClient.Codex]({ sessionId: SESSION_ID })).toEqual([
      ...CODEX_SAFETY_ARGUMENTS,
      'resume',
      SESSION_ID,
      '-',
    ]);
  });

  test.each([ConnectorClient.ClaudeCode, ConnectorClient.Codex])('%s rejects a session id that is not a UUID', (client) => {
    expect(() => RESUME_ARGUMENT_BUILDERS[client]({ sessionId: '--dangerously-skip-permissions' })).toThrow('session id is not a UUID');
  });
});

describe('buildCodexNewSessionArguments', () => {
  test('starts a new session with the same safety flags and reads the prompt from standard input', () => {
    expect(buildCodexNewSessionArguments()).toEqual([...CODEX_SAFETY_ARGUMENTS, '-']);
  });

  test('never resumes', () => {
    expect(buildCodexNewSessionArguments()).not.toContain('resume');
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

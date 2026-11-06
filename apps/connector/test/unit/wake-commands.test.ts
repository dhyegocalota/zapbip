import { ConnectorClient } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import {
  buildCodexNewSessionArguments,
  CLIENT_BINARY_NAME,
  isActiveWriterRefusal,
  RESUME_ARGUMENT_BUILDERS,
} from '../../src/wake-commands';

const SESSION_ID = '0ff172bc-aa4e-4181-989c-3837345aa2cd';
const CLAUDE_ISOLATION_ARGUMENTS = ['--strict-mcp-config', '--mcp-config=/private/zapbip-wake/mcp.json', '--setting-sources='];
const CODEX_ISOLATION_ARGUMENTS = ['-c', 'mcp_servers.deploy.enabled=false'];
const CODEX_SAFETY_ARGUMENTS = [
  'exec',
  '--skip-git-repo-check',
  '-s',
  'read-only',
  '-c',
  'mcp_servers.zapbip.default_tools_approval_mode="approve"',
  '-c',
  'mcp_servers.zapbip.enabled_tools=["send_message"]',
  '-c',
  'web_search="disabled"',
];

describe('CLIENT_BINARY_NAME', () => {
  test('names the binary of each client', () => {
    expect(CLIENT_BINARY_NAME).toEqual({ [ConnectorClient.ClaudeCode]: 'claude', [ConnectorClient.Codex]: 'codex' });
  });
});

describe('RESUME_ARGUMENT_BUILDERS', () => {
  test('Claude Code resumes the session in dontAsk mode with every built-in tool off, only the zapbip server and only send_message allowed', () => {
    expect(
      RESUME_ARGUMENT_BUILDERS[ConnectorClient.ClaudeCode]({ sessionId: SESSION_ID, isolationArguments: CLAUDE_ISOLATION_ARGUMENTS }),
    ).toEqual([
      '-p',
      '--resume',
      SESSION_ID,
      '--permission-mode',
      'dontAsk',
      '--tools=',
      '--strict-mcp-config',
      '--mcp-config=/private/zapbip-wake/mcp.json',
      '--setting-sources=',
      '--allowedTools=mcp__zapbip__send_message',
    ]);
  });

  test('Codex resumes the session read-only with only send_message enabled, every other server off and the prompt on standard input', () => {
    expect(
      RESUME_ARGUMENT_BUILDERS[ConnectorClient.Codex]({ sessionId: SESSION_ID, isolationArguments: CODEX_ISOLATION_ARGUMENTS }),
    ).toEqual([...CODEX_SAFETY_ARGUMENTS, ...CODEX_ISOLATION_ARGUMENTS, 'resume', SESSION_ID, '-']);
  });

  test.each([ConnectorClient.ClaudeCode, ConnectorClient.Codex])('%s rejects a session id that is not a UUID', (client) => {
    expect(() => RESUME_ARGUMENT_BUILDERS[client]({ sessionId: '--dangerously-skip-permissions', isolationArguments: [] })).toThrow(
      'session id is not a UUID',
    );
  });
});

describe('buildCodexNewSessionArguments', () => {
  test('starts a new session with the same safety flags and reads the prompt from standard input', () => {
    expect(buildCodexNewSessionArguments({ isolationArguments: CODEX_ISOLATION_ARGUMENTS })).toEqual([
      ...CODEX_SAFETY_ARGUMENTS,
      ...CODEX_ISOLATION_ARGUMENTS,
      '-',
    ]);
  });

  test('never resumes', () => {
    expect(buildCodexNewSessionArguments({ isolationArguments: [] })).not.toContain('resume');
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

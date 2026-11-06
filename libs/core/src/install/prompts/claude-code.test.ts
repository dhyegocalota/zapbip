import { INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AGENT_RULES } from '../../agent-rules';
import { CONNECTION_LINK, sectionInput } from '../testing/fixtures';
import { CLAUDE_CODE_SKILL_DESCRIPTION } from './claude-code-copy';
import { renderClaudeCodeSection } from './claude-code';
import { ZAPBIP_NPM_VERSION } from './connector-commands';

describe('renderClaudeCodeSection', () => {
  const locale = OwnerLocale.EnglishUs;
  const text = renderClaudeCodeSection(sectionInput({ locale }));

  test('removes the old entry before adding the server', () => {
    const removeAt = text.indexOf('claude mcp remove --scope user zapbip');
    const addAt = text.indexOf(`claude mcp add --transport http --scope user zapbip ${CONNECTION_LINK}`);
    expect(removeAt).toBeGreaterThan(-1);
    expect(addAt).toBeGreaterThan(removeAt);
  });

  test('writes the skill with the agent rules as its body', () => {
    expect(text).toContain('~/.claude/skills/zapbip/SKILL.md');
    expect(text).toContain(`name: zapbip\ndescription: ${CLAUDE_CODE_SKILL_DESCRIPTION[locale]()}\n---\n${AGENT_RULES}`);
  });

  test('runs the pinned connector and leaves the local wake mode to the attach', () => {
    expect(text).toContain(`ZAPBIP_CONNECTION_URL=${CONNECTION_LINK} npx zapbip@${ZAPBIP_NPM_VERSION} connect --client claude-code`);
    expect(text).not.toContain('set_wake');
  });

  test('F1 registers the local channel server and launches the session with it', () => {
    expect(text).toContain(
      `claude mcp add --scope user zapbip-channel -e ZAPBIP_CONNECTION_URL=${CONNECTION_LINK} -- npx zapbip@${ZAPBIP_NPM_VERSION} channel`,
    );
    expect(text).toContain('claude --dangerously-load-development-channels server:zapbip-channel');
    expect(text).not.toMatch(/server:zapbip(?!-channel)/);
    expect(text).toContain('claude mcp remove --scope user zapbip-channel');
  });

  test('lists the channel as primary and the monitored listener as fallback', () => {
    expect(text).toContain('claude --dangerously-load-development-channels server:zapbip-channel');
    expect(text).toContain(`npx zapbip@${ZAPBIP_NPM_VERSION} listen`);
    expect(text).toContain('Monitor');
    expect(text).toContain('re-arm');
    expect(text).toContain('claude -p --resume');
  });

  test('self-tests in a fresh process', () => {
    expect(text).toContain('claude -p');
    expect(text).toContain('--allowedTools=mcp__zapbip__send_message');
    expect(text).toContain(INSTALL_SELF_TEST_TEXT[locale]);
  });
});

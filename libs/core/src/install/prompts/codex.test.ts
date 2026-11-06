import { CODEX_TOOL_TIMEOUT_SECONDS, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CONNECTION_LINK, sectionInput } from '../testing/fixtures';
import { renderCodexSection } from './codex';
import { ZAPBIP_NPM_VERSION } from './connector-commands';

describe('renderCodexSection', () => {
  const text = renderCodexSection(sectionInput({ locale: OwnerLocale.EnglishUs }));

  test('replaces the zapbip table with the url, timeout and approval mode', () => {
    expect(text).toContain('[mcp_servers.zapbip]');
    expect(text).toContain(`url = "${CONNECTION_LINK}"`);
    expect(text).toContain(`tool_timeout_sec = ${CODEX_TOOL_TIMEOUT_SECONDS}`);
    expect(text).toContain('default_tools_approval_mode = "approve"');
  });

  test('removes an existing table first and never appends a second one', () => {
    expect(text).toContain('Remove any existing [mcp_servers.zapbip] table');
    expect(text.match(/^\[mcp_servers\.zapbip\]$/gm)).toHaveLength(1);
  });

  test('warns the owner that tools run unattended in each locale', () => {
    expect(text).toContain('unattended');
    expect(renderCodexSection(sectionInput({ locale: OwnerLocale.PortugueseBrazil }))).toContain('sem supervisão');
  });

  test('runs the pinned connector and sets the local wake mode', () => {
    expect(text).toContain(`ZAPBIP_CONNECTION_URL=${CONNECTION_LINK} npx zapbip@${ZAPBIP_NPM_VERSION} connect --client codex`);
    expect(text).toContain('set_wake({mode: "local"})');
    expect(text).toContain('codex exec resume');
  });

  test('self-tests in a fresh process', () => {
    expect(text).toContain(`codex exec -c 'mcp_servers.zapbip.default_tools_approval_mode="approve"'`);
  });
});

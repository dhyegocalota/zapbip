import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CONNECTION_LINK, sectionInput } from '../testing/fixtures';
import { renderChatGptSection } from './chatgpt';
import { renderClaudeAiSection } from './claude-ai';
import { renderGrokBotSection } from './grok-bot';
import { renderGrokWebSection } from './grok-web';
import { renderHermesSection } from './hermes';
import { renderOpenClawSection } from './openclaw';

const locale = OwnerLocale.EnglishUs;

describe('Grok Bot', () => {
  const text = renderGrokBotSection(sectionInput({ locale }));

  test('adds the server, asks for confirmation and creates the webhook routine', () => {
    expect(text).toContain('MCP server named zapbip');
    expect(text).toContain('confirm');
    expect(text).toContain('routine with a webhook trigger');
    expect(text).toContain('set_wake({mode: "webhook"');
  });
});

describe('claude.ai', () => {
  const text = renderClaudeAiSection(sectionInput({ locale }));

  test('asks for the connector paste and the fire URL and token', () => {
    expect(text).toContain('custom connector');
    expect(text).toContain('fire URL and token');
    expect(text).toContain('set_wake({mode: "webhook"');
  });

  test('asks for the hourly check_inbox safety net and has the stop branch', () => {
    expect(text).toContain('hourly');
    expect(text).toContain('check_inbox');
    expect(text).toContain('set_wake({mode: "none"})');
  });
});

describe('ChatGPT', () => {
  test('names developer mode, no authentication, the local task and always allow', () => {
    const text = renderChatGptSection(sectionInput({ locale }));
    expect(text).toContain('developer mode');
    expect(text).toContain('`No authentication`');
    expect(text).toContain('`Run on this computer`');
    expect(text).toContain('`Always allow`');
    expect(text).toContain('set_wake({mode: "scheduled", interval_minutes: 60})');
  });
});

describe('ChatGPT in Portuguese', () => {
  test('F9 gives the localized label beside the English one', () => {
    const text = renderChatGptSection(sectionInput({ locale: OwnerLocale.PortugueseBrazil }));
    expect(text).toContain('Executar neste computador (`Run on this computer`)');
    expect(text).toContain('Sempre permitir (`Always allow`)');
  });
});

describe('Grok web', () => {
  test('uses the standby agent when there is one', () => {
    const text = renderGrokWebSection(sectionInput({ locale, standbyAgent: 'Ana Bot' }));
    expect(text).toContain('set_wake({mode: "standby", standby_agent: "Ana Bot"})');
    expect(text).not.toContain('set_wake({mode: "none"})');
  });

  test('sets none without a standby agent', () => {
    const text = renderGrokWebSection(sectionInput({ locale, standbyAgent: null }));
    expect(text).toContain('set_wake({mode: "none"})');
    expect(text).not.toContain('standby_agent');
  });

  test('JSON-escapes the standby name so it cannot break out of the call', () => {
    const standbyAgent = 'Ana "Bot"\n';
    const text = renderGrokWebSection(sectionInput({ locale, standbyAgent }));
    expect(text).toContain(`set_wake({mode: "standby", standby_agent: ${JSON.stringify(standbyAgent)}})`);
    expect(text).not.toContain('Ana "Bot"\n');
  });
});

describe.each([
  { name: 'Hermes', render: renderHermesSection, otherName: 'OpenClaw' },
  { name: 'OpenClaw', render: renderOpenClawSection, otherName: 'Hermes' },
])('$name', ({ name, render, otherName }) => {
  test.each([OwnerLocale.PortugueseBrazil, OwnerLocale.EnglishUs])(
    'names only its own product and polls every minute in %s',
    (sectionLocale) => {
      const text = render(sectionInput({ locale: sectionLocale }));
      expect(text).toContain(`If you are not ${name}`);
      expect(text).not.toContain(otherName);
      expect(text).toContain('set_wake({mode: "scheduled", interval_minutes: 1})');
      expect(text).toContain('check_inbox');
      expect(text).toContain('every minute');
      expect(text).not.toContain('(verify)');
    },
  );
});

describe('Hermes allowlist', () => {
  test.each([OwnerLocale.PortugueseBrazil, OwnerLocale.EnglishUs])('sets the owner as an allowed user in %s', (sectionLocale) => {
    expect(renderHermesSection(sectionInput({ locale: sectionLocale }))).toContain('ZAPBIP_ALLOWED_USERS=owner');
  });
});

describe('Hermes and OpenClaw confirmed install steps', () => {
  test('F4 Hermes names the plugin folder, the enable key and both environment variables', () => {
    const text = renderHermesSection(sectionInput({ locale }));
    expect(text).toContain('importable by Hermes');
    expect(text).not.toContain('plugins.enabled');
    expect(text).toContain(`ZAPBIP_CONNECTION_LINK=${CONNECTION_LINK}`);
    expect(text).toContain('ZAPBIP_ALLOWED_USERS=owner');
    expect(text).toContain('pip install zapbip-platform==0.1.0');
  });

  test('F4 OpenClaw installs the published package and sets the connection link on the channel', () => {
    const text = renderOpenClawSection(sectionInput({ locale }));
    expect(text).toContain('openclaw plugins install @zapbip/openclaw-plugin@0.1.0');
    expect(text).toContain('channels.zapbip.connectionLink');
    expect(text).toContain(CONNECTION_LINK);
  });
});

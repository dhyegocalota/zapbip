import { InstallClient } from '@zapbip/types';
import type { InstallSection } from './install-section';
import { renderClaudeCodeSection } from './claude-code';
import { renderCodexSection } from './codex';
import { renderGrokBotSection } from './grok-bot';
import { renderClaudeAiSection } from './claude-ai';
import { renderChatGptSection } from './chatgpt';
import { renderGrokWebSection } from './grok-web';
import { renderHermesSection } from './hermes';
import { renderOpenClawSection } from './openclaw';
import { renderCursorSection } from './cursor';
import { renderGeminiCliSection } from './gemini-cli';

export const INSTALL_SECTIONS: Record<InstallClient, InstallSection> = {
  [InstallClient.ClaudeCode]: renderClaudeCodeSection,
  [InstallClient.Codex]: renderCodexSection,
  [InstallClient.GrokBot]: renderGrokBotSection,
  [InstallClient.ClaudeAi]: renderClaudeAiSection,
  [InstallClient.ChatGpt]: renderChatGptSection,
  [InstallClient.GrokWeb]: renderGrokWebSection,
  [InstallClient.Hermes]: renderHermesSection,
  [InstallClient.OpenClaw]: renderOpenClawSection,
  [InstallClient.Cursor]: renderCursorSection,
  [InstallClient.GeminiCli]: renderGeminiCliSection,
};

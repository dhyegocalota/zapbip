import { InstallClient } from '@zapbip/types';

export type InstallProduct = {
  name: string;
  description: string;
};

export const INSTALL_PRODUCTS: Record<InstallClient, InstallProduct> = {
  [InstallClient.ClaudeCode]: { name: 'Claude Code', description: 'Claude Code, the agent started by the `claude` command' },
  [InstallClient.Codex]: { name: 'Codex', description: 'Codex, the agent started by the `codex` command' },
  [InstallClient.GrokBot]: { name: 'Grok Bot', description: 'Grok Bot, the Grok routines bot' },
  [InstallClient.ClaudeAi]: { name: 'claude.ai', description: 'claude.ai, the chat in the claude.ai web app' },
  [InstallClient.ChatGpt]: { name: 'ChatGPT', description: 'ChatGPT, the chat in the ChatGPT web app' },
  [InstallClient.GrokWeb]: { name: 'Grok web', description: 'Grok web, the chat in the Grok web app' },
  [InstallClient.Hermes]: { name: 'Hermes', description: 'Hermes, the agent running Hermes' },
  [InstallClient.OpenClaw]: { name: 'OpenClaw', description: 'OpenClaw, the agent running OpenClaw' },
  [InstallClient.Cursor]: { name: 'Cursor', description: 'Cursor, the AI code editor and its chat panel' },
  [InstallClient.GeminiCli]: { name: 'Gemini CLI', description: 'Gemini CLI, the agent started by the `gemini` command' },
};

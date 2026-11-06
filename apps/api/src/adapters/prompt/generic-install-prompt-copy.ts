import type { AgentName } from '@zapbip/core';
import { OwnerLocale } from '@zapbip/types';

type PromptCopy = { introduction: (input: { agent: AgentName }) => string; warning: (input: { agent: AgentName }) => string };

export const GENERIC_INSTALL_PROMPT_COPY: Record<OwnerLocale, PromptCopy> = {
  [OwnerLocale.PortugueseBrazil]: {
    introduction: ({ agent }) => `Conecte-se ao zapbip como o agente ${agent} usando este servidor MCP:`,
    warning: ({ agent }) =>
      `Este link é uma senha: quem o tem fala como o agente ${agent}. Não o publique. Para trocá-lo, envie "girar ${agent}" ao zapbip no WhatsApp.`,
  },
  [OwnerLocale.EnglishUs]: {
    introduction: ({ agent }) => `Connect to zapbip as the agent ${agent} using this MCP server:`,
    warning: ({ agent }) =>
      `This link is a password: whoever has it speaks as the agent ${agent}. Do not publish it. To replace it, send "rotate ${agent}" to zapbip on WhatsApp.`,
  },
};

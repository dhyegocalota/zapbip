import { INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import {
  formatSection,
  localizeCopy,
  noticeStep,
  terminalListenStep,
  tellOwnerAndWait,
  FAILURE_OUTPUT_LINES,
  type InstallProduct,
} from '@zapbip/core';

export const GEMINI_CLI_PRODUCT: InstallProduct = {
  productName: 'Gemini CLI',
  productDescription: 'Gemini CLI, the agent started by the `gemini` command',
};

type GeminiCliText = {
  wakeNote: string;
  confirmChange: string;
  restart: string;
};

const GEMINI_CLI_TEXT: Record<OwnerLocale, GeminiCliText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote:
      'O Gemini CLI escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo.',
    confirmChange: 'Vou adicionar o servidor MCP zapbip ao Gemini CLI. Posso?',
    restart: 'Reinicie o Gemini CLI para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'Gemini CLI listens through the background terminal and answers within seconds while it runs, with no time limit.',
    confirmChange: 'I will add the zapbip MCP server to Gemini CLI. May I?',
    restart: 'Restart Gemini CLI to use zapbip.',
  },
};

export const GEMINI_CLI_COPY = localizeCopy({
  texts: GEMINI_CLI_TEXT,
  build: ({ section, text }) => {
    const selfTest = `gemini -p "Call send_message with the text '${INSTALL_SELF_TEST_TEXT[section.locale]}'"`;
    return formatSection({
      ...GEMINI_CLI_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
          success: 'the owner said yes in the chat.',
        },
        {
          action: 'Run `gemini mcp list`. If it lists zapbip, run `gemini mcp remove --scope user zapbip`.',
          success: '`gemini mcp list` no longer lists zapbip.',
        },
        {
          action: `Run \`gemini mcp add --transport http --scope user zapbip ${section.connectionLink}\`.`,
          success: '`gemini mcp list` shows zapbip.',
        },
        terminalListenStep(section),
        noticeStep(text.restart),
        {
          action: `In a fresh process run \`${selfTest}\`. On a non-zero exit stop and show the last ${FAILURE_OUTPUT_LINES} lines of its output.`,
          success: 'the command exits with zero.',
        },
      ],
    });
  },
});

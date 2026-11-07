import { INSTALL_SELF_TEST_TEXT, InstallClient, OwnerLocale } from '@zapbip/types';
import { FAILURE_OUTPUT_LINES } from './connector-commands';
import { formatSection, localizeCopy, noticeStep, terminalListenStep, tellOwnerAndWait } from './section-format';

type GeminiCliText = {
  confirmChange: string;
  restart: string;
};

const GEMINI_CLI_TEXT: Record<OwnerLocale, GeminiCliText> = {
  [OwnerLocale.PortugueseBrazil]: {
    confirmChange: 'Vou adicionar o servidor MCP zapbip ao Gemini CLI. Posso?',
    restart: 'Reinicie o Gemini CLI para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    confirmChange: 'I will add the zapbip MCP server to Gemini CLI. May I?',
    restart: 'Restart Gemini CLI to use zapbip.',
  },
};

export const GEMINI_CLI_COPY = localizeCopy({
  texts: GEMINI_CLI_TEXT,
  build: ({ section, text }) => {
    const selfTest = `gemini -p "Call send_message with the text '${INSTALL_SELF_TEST_TEXT[section.locale]}'"`;
    return formatSection({
      client: InstallClient.GeminiCli,
      locale: section.locale,
      standbyAgent: section.standbyAgent,
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

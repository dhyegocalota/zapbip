import { INSTALL_SELF_TEST_TEXT, InstallClient, OwnerLocale } from '@zapbip/types';
import { FAILURE_OUTPUT_LINES } from './connector-commands';
import { formatSection, localizeCopy, terminalListenStep, tellOwner, tellOwnerAndWait } from './section-format';

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
      steps: [
        `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
        'Run `gemini mcp list`. If it lists zapbip, run `gemini mcp remove --scope user zapbip` (verify).',
        `Run \`gemini mcp add --transport http --scope user zapbip ${section.connectionLink}\`.`,
        terminalListenStep(section),
        'Call `set_wake({mode: "local"})`.',
        tellOwner(text.restart),
        `In a fresh process run \`${selfTest}\`. On a non-zero exit stop and show the last ${FAILURE_OUTPUT_LINES} lines of its output.`,
      ],
    });
  },
});

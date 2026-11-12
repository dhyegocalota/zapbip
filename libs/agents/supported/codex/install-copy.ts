import { INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import { formatSection, localizeCopy, noticeStep, tellOwnerAndWait, FAILURE_OUTPUT_LINES, type InstallProduct } from '@zapbip/core';
import { connectCommand } from '../../src/connect-command';
import { ConnectorClient } from '../../src/generated/ids';
import { quickStartOf } from '../../src/quick-start';

export const CODEX_PRODUCT: InstallProduct = {
  productName: 'Codex',
  productDescription: 'Codex, the agent started by the `codex` command',
};
export const CODEX_TOOL_TIMEOUT_SECONDS = 900;

const CONFIG_PATH = '~/.codex/config.toml';

export function codexConfigTable(input: { connectionLink: string }): string {
  return [
    '[mcp_servers.zapbip]',
    `url = "${input.connectionLink}"`,
    `tool_timeout_sec = ${CODEX_TOOL_TIMEOUT_SECONDS}`,
    'default_tools_approval_mode = "approve"',
  ].join('\n');
}

type CodexText = {
  wakeNote: string;
  confirmChange: string;
  restart: string;
};

const CODEX_TEXT: Record<OwnerLocale, CodexText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O conector retoma a sessão do Codex a cada mensagem, em cerca de 6 segundos, sem limite de tempo.',
    confirmChange: `Vou gravar o servidor zapbip em ${CONFIG_PATH}. Isso faz as ferramentas do zapbip rodarem sem supervisão, sem pedir aprovação a cada uso. Posso?`,
    restart: 'Reinicie o Codex para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'The connector resumes the Codex session on each message, in about 6 seconds, with no time limit.',
    confirmChange: `I will write the zapbip server to ${CONFIG_PATH}. This lets zapbip tools run unattended, without asking for approval on each use. May I?`,
    restart: 'Restart Codex to use zapbip.',
  },
};

export const CODEX_COPY = localizeCopy({
  texts: CODEX_TEXT,
  build: ({ section, text }) => {
    const configTable = codexConfigTable({ connectionLink: section.connectionLink });
    const selfTest = `codex exec -c 'mcp_servers.zapbip.default_tools_approval_mode="approve"' "Call send_message with the text '${INSTALL_SELF_TEST_TEXT[section.locale]}'"`;
    return formatSection({
      ...CODEX_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
          success: 'the owner said yes in the chat.',
        },
        {
          action: `Remove any existing [mcp_servers.zapbip] table from ${CONFIG_PATH}, then append this table, so the file never holds a second one:\n\n\`\`\`toml\n${configTable}\n\`\`\``,
          success: `${CONFIG_PATH} holds exactly one [mcp_servers.zapbip] table with that content.`,
        },
        {
          action: `In the background run \`${connectCommand({ connectionLink: section.connectionLink, client: ConnectorClient.Codex })}\`. It keeps listening and resumes the session with \`codex exec resume\`.`,
          success: 'the connector is running in the background and prints no error.',
        },
        noticeStep(text.restart),
        {
          action: `In a fresh process run \`${selfTest}\`. On a non-zero exit stop and show the last ${FAILURE_OUTPUT_LINES} lines of its output.`,
          success: 'the command exits with zero.',
        },
      ],
    });
  },
});

const CODEX_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: `Adicione ao ${CONFIG_PATH}`,
  [OwnerLocale.EnglishUs]: `Add it to ${CONFIG_PATH}`,
};

export const CODEX_QUICK_START = quickStartOf({
  hint: CODEX_QUICK_START_HINT,
  code: (connectionLink) => codexConfigTable({ connectionLink }),
});

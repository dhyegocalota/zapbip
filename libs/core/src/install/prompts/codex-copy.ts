import { CODEX_TOOL_TIMEOUT_SECONDS, INSTALL_SELF_TEST_TEXT, InstallClient, OwnerLocale } from '@zapbip/types';
import { connectCommand, FAILURE_OUTPUT_LINES } from './connector-commands';
import { formatSection, localizeCopy, tellOwner, tellOwnerAndWait } from './section-format';

const CONFIG_PATH = '~/.codex/config.toml';

type CodexText = {
  confirmChange: string;
  restart: string;
};

const CODEX_TEXT: Record<OwnerLocale, CodexText> = {
  [OwnerLocale.PortugueseBrazil]: {
    confirmChange: `Vou gravar o servidor zapbip em ${CONFIG_PATH}. Isso faz as ferramentas do zapbip rodarem sem supervisão, sem pedir aprovação a cada uso. Posso?`,
    restart: 'Reinicie o Codex para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    confirmChange: `I will write the zapbip server to ${CONFIG_PATH}. This lets zapbip tools run unattended, without asking for approval on each use. May I?`,
    restart: 'Restart Codex to use zapbip.',
  },
};

export const CODEX_COPY = localizeCopy({
  texts: CODEX_TEXT,
  build: ({ section, text }) => {
    const configTable = [
      '[mcp_servers.zapbip]',
      `url = "${section.connectionLink}"`,
      `tool_timeout_sec = ${CODEX_TOOL_TIMEOUT_SECONDS}`,
      'default_tools_approval_mode = "approve"',
    ].join('\n');
    const selfTest = `codex exec -c 'mcp_servers.zapbip.default_tools_approval_mode="approve"' "Call send_message with the text '${INSTALL_SELF_TEST_TEXT[section.locale]}'"`;
    return formatSection({
      client: InstallClient.Codex,
      locale: section.locale,
      standbyAgent: section.standbyAgent,
      steps: [
        `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
        `Remove any existing [mcp_servers.zapbip] table from ${CONFIG_PATH}, then append this table, so the file never holds a second one:\n\n\`\`\`toml\n${configTable}\n\`\`\``,
        `In the background run \`${connectCommand({ connectionLink: section.connectionLink, client: InstallClient.Codex })}\`. It keeps listening and resumes the session with \`codex exec resume\`.`,
        tellOwner(text.restart),
        `In a fresh process run \`${selfTest}\`. On a non-zero exit stop and show the last ${FAILURE_OUTPUT_LINES} lines of its output.`,
      ],
    });
  },
});

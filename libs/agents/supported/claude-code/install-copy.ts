import { INSTALL_SELF_TEST_TEXT, InstallClient, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import {
  formatSection,
  localizeCopy,
  monitoredListenStep,
  noticeStep,
  tellOwnerAndWait,
  CONNECTION_URL_VARIABLE,
  connectCommand,
  FAILURE_OUTPUT_LINES,
  AGENT_RULES,
  type InstallProduct,
} from '@zapbip/core';

export const CLAUDE_CODE_PRODUCT: InstallProduct = {
  productName: 'Claude Code',
  productDescription: 'Claude Code, the agent started by the `claude` command',
};

const SKILL_PATH = '~/.claude/skills/zapbip/SKILL.md';
const LISTENER_RULE = 'A connection holds one listener and a second replaces the first: use exactly one of these, never two together.';
const CHANNEL_COMMAND = 'claude --dangerously-load-development-channels server:zapbip-channel';

type ClaudeCodeText = {
  wakeNote: string;
  confirmChange: string;
  restart: string;
};

const CLAUDE_CODE_TEXT: Record<OwnerLocale, ClaudeCodeText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote:
      'O Claude Code escuta sem limite de tempo: o canal entrega na hora com a sessão aberta, e o conector retoma uma sessão parada em cerca de 7 segundos.',
    confirmChange: `Vou adicionar o servidor MCP zapbip ao Claude Code e gravar o arquivo ${SKILL_PATH}. Posso?`,
    restart: `Reinicie o Claude Code com \`${CHANNEL_COMMAND}\` para usar o zapbip. Essa opção liga o recurso de canais do Claude Code para o zapbip e não aprova nenhuma ferramenta sozinha.`,
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote:
      'Claude Code listens with no time limit: the channel delivers at once while the session is open, and the connector resumes a stopped session in about 7 seconds.',
    confirmChange: `I will add the zapbip MCP server to Claude Code and write the file ${SKILL_PATH}. May I?`,
    restart: `Restart Claude Code with \`${CHANNEL_COMMAND}\` to use zapbip. The flag turns on Claude Code's channel feature for zapbip and does not approve any tool by itself.`,
  },
};

export const CLAUDE_CODE_SKILL_DESCRIPTION: Record<OwnerLocale, () => string> = {
  [OwnerLocale.PortugueseBrazil]: () =>
    'Regras para falar com o dono pelo WhatsApp usando o zapbip: perguntar, esperar a resposta e escrever curto.',
  [OwnerLocale.EnglishUs]: () => 'Rules for talking to the owner on WhatsApp through zapbip: ask, wait for the answer and write short.',
};

export const CLAUDE_CODE_COPY = localizeCopy({
  texts: CLAUDE_CODE_TEXT,
  build: ({ section, text }) => {
    const skillContent = [
      '---',
      'name: zapbip',
      `description: ${CLAUDE_CODE_SKILL_DESCRIPTION[section.locale]()}`,
      '---',
      AGENT_RULES,
    ].join('\n');
    const selfTest = `claude -p "Call send_message with the text '${INSTALL_SELF_TEST_TEXT[section.locale]}'" --allowedTools=mcp__zapbip__send_message`;
    return formatSection({
      ...CLAUDE_CODE_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
          success: 'the owner said yes in the chat.',
        },
        {
          action:
            'Run `claude mcp list`. If it lists zapbip or zapbip-channel, run `claude mcp remove --scope user zapbip` or `claude mcp remove --scope user zapbip-channel` for each.',
          success: '`claude mcp list` no longer lists them.',
        },
        {
          action: `Run \`claude mcp add --transport http --scope user zapbip ${section.connectionLink}\` for the tools.`,
          success: '`claude mcp list` shows zapbip.',
        },
        {
          action: `Run \`claude mcp add --scope user zapbip-channel -e ${CONNECTION_URL_VARIABLE}=${section.connectionLink} -- npx zapbip@${ZAPBIP_NPM_VERSION} channel\` for the live channel.`,
          success: '`claude mcp list` shows zapbip-channel.',
        },
        {
          action: `Write ${SKILL_PATH} with exactly this content:\n\n\`\`\`\n${skillContent}\n\`\`\``,
          success: 'the file holds exactly that content.',
        },
        {
          action: `${LISTENER_RULE} If the session supports development channels, the zapbip-channel server pushes each owner message into the session once Claude Code is started with \`${CHANNEL_COMMAND}\`. If it does not, in the background run \`${connectCommand({ connectionLink: section.connectionLink, client: InstallClient.ClaudeCode })}\`, which resumes a stopped session with \`claude -p --resume\`. If connect cannot run either, listen instead. ${monitoredListenStep(section)}`,
          success: 'exactly one listener is running.',
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

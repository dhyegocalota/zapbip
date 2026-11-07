import { INSTALL_SELF_TEST_TEXT, InstallClient, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { AGENT_RULES } from '../../agent-rules';
import { CONNECTION_URL_VARIABLE, connectCommand, FAILURE_OUTPUT_LINES } from './connector-commands';
import { formatSection, localizeCopy, monitoredListenStep, tellOwner, tellOwnerAndWait } from './section-format';

const SKILL_PATH = '~/.claude/skills/zapbip/SKILL.md';
const LISTENER_RULE = 'A connection holds one listener and a second replaces the first: use exactly one of these, never two together.';
const CHANNEL_COMMAND = 'claude --dangerously-load-development-channels server:zapbip-channel';

type ClaudeCodeText = {
  confirmChange: string;
  restart: string;
};

const CLAUDE_CODE_TEXT: Record<OwnerLocale, ClaudeCodeText> = {
  [OwnerLocale.PortugueseBrazil]: {
    confirmChange: `Vou adicionar o servidor MCP zapbip ao Claude Code e gravar o arquivo ${SKILL_PATH}. Posso?`,
    restart: `Reinicie o Claude Code com \`${CHANNEL_COMMAND}\` para usar o zapbip.`,
  },
  [OwnerLocale.EnglishUs]: {
    confirmChange: `I will add the zapbip MCP server to Claude Code and write the file ${SKILL_PATH}. May I?`,
    restart: `Restart Claude Code with \`${CHANNEL_COMMAND}\` to use zapbip.`,
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
      client: InstallClient.ClaudeCode,
      locale: section.locale,
      standbyAgent: section.standbyAgent,
      steps: [
        `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
        'Run `claude mcp list`. If it lists zapbip or zapbip-channel, run `claude mcp remove --scope user zapbip` or `claude mcp remove --scope user zapbip-channel` for each.',
        `Run \`claude mcp add --transport http --scope user zapbip ${section.connectionLink}\` for the tools.`,
        `Run \`claude mcp add --scope user zapbip-channel -e ${CONNECTION_URL_VARIABLE}=${section.connectionLink} -- npx zapbip@${ZAPBIP_NPM_VERSION} channel\` for the live channel.`,
        `Write ${SKILL_PATH} with exactly this content:\n\n\`\`\`\n${skillContent}\n\`\`\``,
        `${LISTENER_RULE} Open session: the zapbip-channel server pushes each owner message into the session once Claude Code is started with \`${CHANNEL_COMMAND}\`. Stopped session: in the background run \`${connectCommand({ connectionLink: section.connectionLink, client: InstallClient.ClaudeCode })}\`, which resumes it with \`claude -p --resume\`. Only if channels are unavailable: ${monitoredListenStep(section)}`,
        tellOwner(text.restart),
        `In a fresh process run \`${selfTest}\`. On a non-zero exit stop and show the last ${FAILURE_OUTPUT_LINES} lines of its output.`,
      ],
    });
  },
});

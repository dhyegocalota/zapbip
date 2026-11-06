import { INSTALL_SELF_TEST_TEXT, InstallClient, OwnerLocale } from '@zapbip/types';
import { AGENT_RULES } from '../../agent-rules';
import { connectCommand, FAILURE_OUTPUT_LINES } from './connector-commands';
import { formatSection, localizeCopy, monitoredListenStep, tellOwner, tellOwnerAndWait } from './section-format';

const SKILL_PATH = '~/.claude/skills/zapbip/SKILL.md';
const CHANNEL_COMMAND = 'claude --dangerously-load-development-channels server:zapbip';

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
      steps: [
        `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
        'Run `claude mcp list`. If it lists zapbip, run `claude mcp remove --scope user zapbip`.',
        `Run \`claude mcp add --transport http --scope user zapbip ${section.connectionLink}\`.`,
        `Write ${SKILL_PATH} with exactly this content:\n\n\`\`\`\n${skillContent}\n\`\`\``,
        `In the background run \`${connectCommand({ connectionLink: section.connectionLink, client: InstallClient.ClaudeCode })}\`. It resumes a closed session with \`claude -p --resume\`.`,
        `Listen in an open session. Primary: the zapbip channel pushes each owner message into the session once Claude Code is started with \`${CHANNEL_COMMAND}\`. Fallback if the channel is not loaded. ${monitoredListenStep(section)}`,
        'Call `set_wake({mode: "local"})`.',
        tellOwner(text.restart),
        `In a fresh process run \`${selfTest}\`. On a non-zero exit stop and show the last ${FAILURE_OUTPUT_LINES} lines of its output.`,
      ],
    });
  },
});

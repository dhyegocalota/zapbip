import { HEARTBEAT_POLL_INTERVAL_MINUTES, InstallClient, OwnerLocale } from '@zapbip/types';
import { OPENCLAW_INSTALL_COMMAND } from './connector-commands';
import { chatSelfTest, formatSection, localizeCopy, noticeStep, tellOwnerAndWait } from './section-format';

type OpenClawText = {
  pluginPermission: string;
  pollCost: string;
};

const OPENCLAW_TEXT: Record<OwnerLocale, OpenClawText> = {
  [OwnerLocale.PortugueseBrazil]: {
    pluginPermission:
      'O plugin do zapbip lê as suas mensagens para este agente no zapbip e publica as respostas do agente de volta. Ele não faz mais nada. Posso instalar?',
    pollCost: 'Verificar a cada minuto gasta chamadas do modelo.',
  },
  [OwnerLocale.EnglishUs]: {
    pluginPermission:
      'The zapbip plugin reads your messages for this agent from zapbip and posts the agent replies back. It does nothing else. May I install it?',
    pollCost: 'Checking every minute costs model calls.',
  },
};

export const OPENCLAW_COPY = localizeCopy({
  texts: OPENCLAW_TEXT,
  build: ({ section, text }) =>
    formatSection({
      client: InstallClient.OpenClaw,
      locale: section.locale,
      standbyAgent: section.standbyAgent,
      steps: [
        {
          action: `Add \`mcp.servers.zapbip\` with \`transport: "streamable-http"\` and the URL ${section.connectionLink}. If the URL form is refused, use the same host with \`/mcp\` and the header \`Authorization: Bearer <the secret after /c/ in that URL>\`.`,
          success: '`mcp.servers` holds the zapbip entry.',
        },
        {
          action: `Preferred: ${tellOwnerAndWait(text.pluginPermission)} If the owner says no, skip to the next step. If yes, run \`${OPENCLAW_INSTALL_COMMAND}\` and set \`channels.zapbip.connectionLink\` to ${section.connectionLink}. The plugin is the listener, with no time limit. If it works, call \`set_wake({mode: "local"})\` and go to the last step.`,
          success: 'the install command exits with zero and set_wake returns without an error, or the owner said no.',
        },
        {
          action: `Only if the plugin cannot be installed, and never together with it: with the automations tool create a job that runs every minute (\`every 1m\`) and calls \`check_inbox\`, then call \`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})\`.`,
          success: 'the automations tool lists the job and set_wake returns without an error.',
        },
        noticeStep(text.pollCost),
        chatSelfTest(section.locale),
      ],
    }),
});

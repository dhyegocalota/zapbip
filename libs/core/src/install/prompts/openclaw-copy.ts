import { HEARTBEAT_POLL_INTERVAL_MINUTES, InstallClient, OwnerLocale } from '@zapbip/types';
import { listenCommand } from './connector-commands';
import { chatSelfTest, formatSection, localizeCopy, tellOwner } from './section-format';

type OpenClawText = {
  pollCost: string;
};

const OPENCLAW_TEXT: Record<OwnerLocale, OpenClawText> = {
  [OwnerLocale.PortugueseBrazil]: { pollCost: 'Verificar a cada minuto gasta chamadas do modelo.' },
  [OwnerLocale.EnglishUs]: { pollCost: 'Checking every minute costs model calls.' },
};

export const OPENCLAW_COPY = localizeCopy({
  texts: OPENCLAW_TEXT,
  build: ({ section, text }) =>
    formatSection({
      client: InstallClient.OpenClaw,
      steps: [
        `Add \`mcp.servers.zapbip\` with \`transport: "streamable-http"\` and the URL ${section.connectionLink} (verify whether OpenClaw also needs the Bearer header).`,
        'Preferred: install the zapbip channel plugin (verify). If it works, call `set_wake({mode: "local"})` and go to the last step.',
        `Fallback: with the automations tool create a \`stream\` job that keeps \`${listenCommand(section)}\` running (verify), or a job that runs every minute (\`every 1m\`) and calls \`check_inbox\` (verify).`,
        `Call \`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})\`.`,
        tellOwner(text.pollCost),
        chatSelfTest(section.locale),
      ],
    }),
});

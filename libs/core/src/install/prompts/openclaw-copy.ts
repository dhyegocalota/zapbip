import { HEARTBEAT_POLL_INTERVAL_MINUTES, InstallClient, OwnerLocale } from '@zapbip/types';
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
      locale: section.locale,
      steps: [
        `Add \`mcp.servers.zapbip\` with \`transport: "streamable-http"\` and the URL ${section.connectionLink} (verify whether OpenClaw also needs the Bearer header).`,
        'Preferred: install the zapbip channel plugin (verify). The plugin is the listener, with no time limit. If it works, call `set_wake({mode: "local"})` and go to the last step.',
        `Only if the plugin cannot be installed, and never together with it: with the automations tool create a job that runs every minute (\`every 1m\`) and calls \`check_inbox\` (verify), then call \`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})\`.`,
        tellOwner(text.pollCost),
        chatSelfTest(section.locale),
      ],
    }),
});

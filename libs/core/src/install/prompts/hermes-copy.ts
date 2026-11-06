import { HEARTBEAT_POLL_INTERVAL_MINUTES, InstallClient, OwnerLocale } from '@zapbip/types';
import { listenCommand } from './connector-commands';
import { chatSelfTest, formatSection, localizeCopy, tellOwner } from './section-format';

type HermesText = {
  pollCost: string;
};

const HERMES_TEXT: Record<OwnerLocale, HermesText> = {
  [OwnerLocale.PortugueseBrazil]: { pollCost: 'Verificar a cada minuto gasta chamadas do modelo.' },
  [OwnerLocale.EnglishUs]: { pollCost: 'Checking every minute costs model calls.' },
};

export const HERMES_COPY = localizeCopy({
  texts: HERMES_TEXT,
  build: ({ section, text }) =>
    formatSection({
      client: InstallClient.Hermes,
      steps: [
        `Add the MCP server named zapbip to \`config.yaml\` under \`mcp_servers\` with \`url: ${section.connectionLink}\` (verify whether Hermes also needs \`headers\`).`,
        'Preferred: install and enable the zapbip platform plugin (verify). If it works, call `set_wake({mode: "local"})` and go to the last step.',
        `Fallback: start \`${listenCommand(section)}\` with \`terminal(background=true, watch_patterns=…)\` (verify), or create a \`cronjob_manage\` job that runs every minute and calls \`check_inbox\` (verify).`,
        `Call \`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})\`.`,
        tellOwner(text.pollCost),
        chatSelfTest(section.locale),
      ],
    }),
});

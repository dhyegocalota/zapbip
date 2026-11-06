import { HEARTBEAT_POLL_INTERVAL_MINUTES, InstallClient, OwnerLocale } from '@zapbip/types';
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
      locale: section.locale,
      steps: [
        `Add the MCP server named zapbip to \`config.yaml\` under \`mcp_servers\` with \`url: ${section.connectionLink}\` (verify whether Hermes also needs \`headers\`).`,
        'Preferred: install and enable the zapbip platform plugin with `ZAPBIP_ALLOWED_USERS=owner` set in its environment, because the Hermes allowlist otherwise refuses the owner (verify). The plugin is the listener, with no time limit. If it works, call `set_wake({mode: "local"})` and go to the last step.',
        `Only if the plugin cannot be installed, and never together with it: create a \`cronjob_manage\` job that runs every minute and calls \`check_inbox\` (verify), then call \`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})\`.`,
        tellOwner(text.pollCost),
        chatSelfTest(section.locale),
      ],
    }),
});

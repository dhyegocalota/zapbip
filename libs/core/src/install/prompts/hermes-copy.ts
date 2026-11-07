import { HEARTBEAT_POLL_INTERVAL_MINUTES, InstallClient, OwnerLocale } from '@zapbip/types';
import { HERMES_INSTALL_COMMAND } from './connector-commands';
import { chatSelfTest, formatSection, localizeCopy, noticeStep } from './section-format';

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
      standbyAgent: section.standbyAgent,
      steps: [
        {
          action: `Add the MCP server named zapbip to \`config.yaml\` under \`mcp_servers\` with \`url: ${section.connectionLink}\`.`,
          success: '`config.yaml` holds the zapbip entry under `mcp_servers`.',
        },
        {
          action: `Preferred: run \`${HERMES_INSTALL_COMMAND}\` so it is importable by Hermes (Hermes then enables the platform by itself), and set \`ZAPBIP_CONNECTION_LINK=${section.connectionLink}\` and \`ZAPBIP_ALLOWED_USERS=owner\` in the Hermes environment, because the Hermes allowlist otherwise refuses the owner. The plugin is the listener, with no time limit. If it works, call \`set_wake({mode: "local"})\` and go to the last step.`,
          success: 'the install command exits with zero and set_wake returns without an error.',
        },
        {
          action: `Only if the plugin cannot be installed, and never together with it: create a \`cronjob_manage\` job that runs every minute and calls \`check_inbox\`, then call \`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})\`.`,
          success: 'the job is listed by `cronjob_manage` and set_wake returns without an error.',
        },
        noticeStep(text.pollCost),
        chatSelfTest(section.locale),
      ],
    }),
});

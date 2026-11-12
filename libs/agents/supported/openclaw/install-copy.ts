import { HEARTBEAT_POLL_INTERVAL_MINUTES, OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, noticeStep, tellOwnerAndWait, type InstallProduct } from '@zapbip/core';
import { installCommand } from './plugin';
import { addressText, quickStartOf } from '../../src/quick-start';

export const OPENCLAW_PRODUCT: InstallProduct = { productName: 'OpenClaw', productDescription: 'OpenClaw, the agent running OpenClaw' };

type OpenClawText = {
  wakeNote: string;
  pluginPermission: string;
  pollCost: string;
};

const OPENCLAW_TEXT: Record<OwnerLocale, OpenClawText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O plugin entrega cada mensagem na hora; sem o plugin, o OpenClaw verifica a caixa de entrada a cada minuto.',
    pluginPermission:
      'O plugin do zapbip lê as suas mensagens para este agente no zapbip e publica as respostas do agente de volta. Ele não faz mais nada. Posso instalar?',
    pollCost: 'Verificar a cada minuto gasta chamadas do modelo.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'The plugin delivers each message at once; without the plugin, OpenClaw checks the inbox every minute.',
    pluginPermission:
      'The zapbip plugin reads your messages for this agent from zapbip and posts the agent replies back. It does nothing else. May I install it?',
    pollCost: 'Checking every minute costs model calls.',
  },
};

export const OPENCLAW_COPY = localizeCopy({
  texts: OPENCLAW_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...OPENCLAW_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `Add \`mcp.servers.zapbip\` with \`transport: "streamable-http"\` and the URL ${section.connectionLink}. If the URL form is refused, use the same host with \`/mcp\` and the header \`Authorization: Bearer <the secret after /c/ in that URL>\`.`,
          success: '`mcp.servers` holds the zapbip entry.',
        },
        {
          action: `Preferred: ${tellOwnerAndWait(text.pluginPermission)} If the owner says no, skip to the next step. If yes, run \`${installCommand}\` and set \`channels.zapbip.connectionLink\` to ${section.connectionLink}. The plugin is the listener, with no time limit. If it works, call \`set_wake({mode: "local"})\` and go to the last step.`,
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

const OPENCLAW_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Na configuração do OpenClaw, em mcp.servers.zapbip',
  [OwnerLocale.EnglishUs]: 'In the OpenClaw config, under mcp.servers.zapbip',
};

export const OPENCLAW_QUICK_START = quickStartOf({
  hint: OPENCLAW_QUICK_START_HINT,
  code: (connectionLink) => `transport: "streamable-http"\nurl: ${connectionLink}`,
  proof: () => 'transport: "streamable-http"',
});

import { InstallClient, OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, tellOwner } from './section-format';

type GrokBotText = {
  confirmServer: string;
};

const GROK_BOT_TEXT: Record<OwnerLocale, GrokBotText> = {
  [OwnerLocale.PortugueseBrazil]: {
    confirmServer: 'Estou adicionando o servidor MCP zapbip ao Grok Bot. Confirme a adição quando ele pedir.',
  },
  [OwnerLocale.EnglishUs]: { confirmServer: 'I am adding the zapbip MCP server to Grok Bot. Confirm it when it asks.' },
};

export const GROK_BOT_COPY = localizeCopy({
  texts: GROK_BOT_TEXT,
  build: ({ section, text }) =>
    formatSection({
      client: InstallClient.GrokBot,
      locale: section.locale,
      standbyAgent: section.standbyAgent,
      steps: [
        `Add the MCP server named zapbip at ${section.connectionLink}. ${tellOwner(text.confirmServer)} Wait for the owner to confirm.`,
        'Create a routine with a webhook trigger.',
        'Call `set_wake({mode: "webhook", url: <the webhook URL of the routine>, token: <the key of the routine>})`. On an error stop and report the error text.',
        chatSelfTest(section.locale),
      ],
    }),
});

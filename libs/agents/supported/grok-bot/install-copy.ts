import { OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, tellOwner, type InstallProduct } from '@zapbip/core';
import { addressText, quickStartOf } from '../../src/quick-start';

export const GROK_BOT_PRODUCT: InstallProduct = { productName: 'Grok Bot', productDescription: 'Grok Bot, the Grok routines bot' };

type GrokBotText = {
  wakeNote: string;
  confirmServer: string;
};

const GROK_BOT_TEXT: Record<OwnerLocale, GrokBotText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O webhook da rotina acorda o Grok Bot em cerca de 9 segundos, sem limite de tempo.',
    confirmServer: 'Estou adicionando o servidor MCP zapbip ao Grok Bot. Confirme a adição quando ele pedir.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'The routine webhook wakes Grok Bot in about 9 seconds, with no time limit.',
    confirmServer: 'I am adding the zapbip MCP server to Grok Bot. Confirm it when it asks.',
  },
};

export const GROK_BOT_COPY = localizeCopy({
  texts: GROK_BOT_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...GROK_BOT_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `Add the MCP server named zapbip at ${section.connectionLink}. ${tellOwner(text.confirmServer)} Wait for the owner to confirm.`,
          success: 'the owner confirmed the server in the chat.',
        },
        { action: 'Create a routine with a webhook trigger.', success: 'the routine exists and shows its webhook URL and key.' },
        {
          action:
            'Call `set_wake({mode: "webhook", url: <the webhook URL of the routine>, token: <the key of the routine>})`. On an error stop and report the error text.',
          success: 'set_wake returns without an error.',
        },
        chatSelfTest(section.locale),
      ],
    }),
});

const GROK_BOT_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'No Grok Bot, adicione um servidor MCP chamado zapbip neste endereço',
  [OwnerLocale.EnglishUs]: 'In Grok Bot, add an MCP server named zapbip at this address',
};

export const GROK_BOT_QUICK_START = quickStartOf({ hint: GROK_BOT_QUICK_START_HINT, code: addressText });

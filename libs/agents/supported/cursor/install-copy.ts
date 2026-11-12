import { OwnerLocale } from '@zapbip/types';
import {
  chatSelfTest,
  formatSection,
  localizeCopy,
  noticeStep,
  terminalListenStep,
  tellOwnerAndWait,
  type InstallProduct,
} from '@zapbip/core';
import { addressText, quickStartOf } from '../../src/quick-start';

export const CURSOR_PRODUCT: InstallProduct = {
  productName: 'Cursor',
  productDescription: 'Cursor, the AI code editor and its chat panel',
};

type CursorText = {
  wakeNote: string;
  confirmChange: string;
  restart: string;
};

const CURSOR_TEXT: Record<OwnerLocale, CursorText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O Cursor escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo.',
    confirmChange: 'Vou adicionar o servidor zapbip às configurações de MCP do Cursor. Posso?',
    restart: 'Reinicie o chat do Cursor para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'Cursor listens through the background terminal and answers within seconds while it runs, with no time limit.',
    confirmChange: 'I will add the zapbip server to the Cursor MCP settings. May I?',
    restart: 'Restart the Cursor chat to use zapbip.',
  },
};

export const CURSOR_COPY = localizeCopy({
  texts: CURSOR_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...CURSOR_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
          success: 'the owner said yes in the chat.',
        },
        {
          action: `Add an MCP server named zapbip over HTTP at ${section.connectionLink} in the Cursor MCP settings.`,
          success: 'the Cursor MCP settings list zapbip.',
        },
        terminalListenStep(section),
        noticeStep(text.restart),
        chatSelfTest(section.locale),
      ],
    }),
});

const CURSOR_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Configurações do Cursor → MCP → adicione um servidor HTTP neste endereço',
  [OwnerLocale.EnglishUs]: 'Cursor Settings → MCP → add an HTTP server at this address',
};

export const CURSOR_QUICK_START = quickStartOf({ hint: CURSOR_QUICK_START_HINT, code: addressText });

import { InstallClient, OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, noticeStep, terminalListenStep, tellOwnerAndWait } from './section-format';

type CursorText = {
  confirmChange: string;
  restart: string;
};

const CURSOR_TEXT: Record<OwnerLocale, CursorText> = {
  [OwnerLocale.PortugueseBrazil]: {
    confirmChange: 'Vou adicionar o servidor zapbip às configurações de MCP do Cursor. Posso?',
    restart: 'Reinicie o chat do Cursor para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    confirmChange: 'I will add the zapbip server to the Cursor MCP settings. May I?',
    restart: 'Restart the Cursor chat to use zapbip.',
  },
};

export const CURSOR_COPY = localizeCopy({
  texts: CURSOR_TEXT,
  build: ({ section, text }) =>
    formatSection({
      client: InstallClient.Cursor,
      locale: section.locale,
      standbyAgent: section.standbyAgent,
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

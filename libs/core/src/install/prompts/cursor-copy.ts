import { InstallClient, OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, monitoredListenStep, tellOwner, tellOwnerAndWait } from './section-format';

type CursorText = {
  confirmServer: string;
  restart: string;
};

const CURSOR_TEXT: Record<OwnerLocale, CursorText> = {
  [OwnerLocale.PortugueseBrazil]: {
    confirmServer: 'Adicionei o servidor zapbip nas configurações de MCP do Cursor. Confirme a adição quando o Cursor pedir.',
    restart: 'Reinicie o chat do Cursor para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    confirmServer: 'I added the zapbip server to the Cursor MCP settings. Confirm it when Cursor asks.',
    restart: 'Restart the Cursor chat to use zapbip.',
  },
};

export const CURSOR_COPY = localizeCopy({
  texts: CURSOR_TEXT,
  build: ({ section, text }) =>
    formatSection({
      client: InstallClient.Cursor,
      steps: [
        `Add an MCP server named zapbip over HTTP at ${section.connectionLink} in the Cursor MCP settings. ${tellOwnerAndWait(text.confirmServer)}`,
        monitoredListenStep(section),
        'Call `set_wake({mode: "local"})`.',
        tellOwner(text.restart),
        chatSelfTest(section.locale),
      ],
    }),
});

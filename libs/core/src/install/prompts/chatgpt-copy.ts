import { CHATGPT_POLL_INTERVAL_MINUTES, InstallClient, OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, tellOwnerAndWait } from './section-format';

type ChatGptText = {
  addApp: (connectionLink: string) => string;
  createTask: string;
};

const CHATGPT_TEXT: Record<OwnerLocale, ChatGptText> = {
  [OwnerLocale.PortugueseBrazil]: {
    addApp: (connectionLink) =>
      `Ative o developer mode nas configurações do ChatGPT e adicione um app pela URL ${connectionLink} com \`No authentication\`.`,
    createTask:
      'Em um chat só para isso, crie uma tarefa por hora com Executar neste computador (`Run on this computer`) que chama check_inbox, e escolha Sempre permitir (`Always allow`) uma vez por ferramenta.',
  },
  [OwnerLocale.EnglishUs]: {
    addApp: (connectionLink) =>
      `Enable developer mode in the ChatGPT settings and add an app by the URL ${connectionLink} with \`No authentication\`.`,
    createTask:
      'In one dedicated chat, create an hourly task with `Run on this computer` that calls check_inbox, and choose `Always allow` once per tool.',
  },
};

export const CHATGPT_COPY = localizeCopy({
  texts: CHATGPT_TEXT,
  build: ({ section, text }) =>
    formatSection({
      client: InstallClient.ChatGpt,
      locale: section.locale,
      standbyAgent: section.standbyAgent,
      steps: [
        tellOwnerAndWait(text.addApp(section.connectionLink)),
        tellOwnerAndWait(text.createTask),
        `Call \`set_wake({mode: "scheduled", interval_minutes: ${CHATGPT_POLL_INTERVAL_MINUTES}})\`.`,
        chatSelfTest(section.locale),
      ],
    }),
});

import { OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, questionStep, type InstallProduct } from '@zapbip/core';

export const CHATGPT_PRODUCT: InstallProduct = { productName: 'ChatGPT', productDescription: 'ChatGPT, the chat in the ChatGPT web app' };
export const CHATGPT_POLL_INTERVAL_MINUTES = 60;

type ChatGptText = {
  wakeNote: string;
  addApp: (connectionLink: string) => string;
  createTask: string;
};

const CHATGPT_TEXT: Record<OwnerLocale, ChatGptText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O ChatGPT é acordado por uma tarefa agendada a cada hora: uma mensagem pode esperar até uma hora.',
    addApp: (connectionLink) =>
      `Ative o developer mode nas configurações do ChatGPT e adicione um app pela URL ${connectionLink} com \`No authentication\`.`,
    createTask:
      'Em um chat só para isso, crie uma tarefa por hora com Executar neste computador (`Run on this computer`) que chama check_inbox, e escolha Sempre permitir (`Always allow`) uma vez por ferramenta.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'ChatGPT is woken by a scheduled task every hour: a message can wait up to an hour.',
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
      ...CHATGPT_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        questionStep(text.addApp(section.connectionLink)),
        questionStep(text.createTask),
        {
          action: `Call \`set_wake({mode: "scheduled", interval_minutes: ${CHATGPT_POLL_INTERVAL_MINUTES}})\`.`,
          success: 'set_wake returns without an error.',
        },
        chatSelfTest(section.locale),
      ],
    }),
});

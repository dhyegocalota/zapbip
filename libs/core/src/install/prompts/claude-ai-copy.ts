import { InstallClient, OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, tellOwner, tellOwnerAndWait } from './section-format';

type ClaudeAiText = {
  pasteConnector: (connectionLink: string) => string;
  pasteTrigger: string;
  withoutTrigger: string;
  createHourlyTask: string;
};

const CLAUDE_AI_TEXT: Record<OwnerLocale, ClaudeAiText> = {
  [OwnerLocale.PortugueseBrazil]: {
    pasteConnector: (connectionLink) => `Cole este endereço como conector personalizado nas configurações do claude.ai: ${connectionLink}`,
    pasteTrigger:
      'Crie uma tarefa com gatilho de API em claude.ai/code/routines, clique em Generate token e cole aqui a URL de disparo (fire URL) e o token. O token aparece uma vez.',
    withoutTrigger: 'Sem o gatilho, este chat só vê mensagens novas quando você o abrir.',
    createHourlyTask: 'Crie também uma tarefa por hora que chama check_inbox, como rede de segurança.',
  },
  [OwnerLocale.EnglishUs]: {
    pasteConnector: (connectionLink) => `Paste this address as a custom connector in the claude.ai settings: ${connectionLink}`,
    pasteTrigger:
      'Create a task with an API trigger at claude.ai/code/routines, click Generate token and paste the fire URL and token here. The token is shown once.',
    withoutTrigger: 'Without the trigger, this chat sees new messages only when you open it.',
    createHourlyTask: 'Also create an hourly task that calls check_inbox, as a safety net.',
  },
};

export const CLAUDE_AI_COPY = localizeCopy({
  texts: CLAUDE_AI_TEXT,
  build: ({ section, text }) =>
    formatSection({
      client: InstallClient.ClaudeAi,
      locale: section.locale,
      standbyAgent: section.standbyAgent,
      steps: [
        tellOwnerAndWait(text.pasteConnector(section.connectionLink)),
        tellOwnerAndWait(text.pasteTrigger),
        `If the owner stops here, call \`set_wake({mode: "none"})\`. ${tellOwner(text.withoutTrigger)} Then go to the last step.`,
        'Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text.',
        tellOwner(text.createHourlyTask),
        chatSelfTest(section.locale),
      ],
    }),
});

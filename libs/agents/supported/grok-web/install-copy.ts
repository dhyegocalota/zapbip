import { OwnerLocale } from '@zapbip/types';
import {
  chatSelfTest,
  formatSection,
  localizeCopy,
  questionStep,
  type InstallStep,
  type InstallSectionInput,
  type InstallProduct,
} from '@zapbip/core';
import { addressText, quickStartOf } from '../../src/quick-start';

export const GROK_WEB_PRODUCT: InstallProduct = { productName: 'Grok web', productDescription: 'Grok web, the chat in the Grok web app' };

type GrokWebText = {
  wakeNote: string;
  wakeNoteWithoutStandby: string;
  pasteConnector: (connectionLink: string) => string;
};

const GROK_WEB_TEXT: Record<OwnerLocale, GrokWebText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O Grok na web não acorda sozinho: o agente de prontidão escolhido responde por ele em segundos.',
    wakeNoteWithoutStandby: 'Sem um agente de prontidão, o Grok na web só vê mensagens novas quando você abre o chat dele.',
    pasteConnector: (connectionLink) => `Cole este endereço como conector nas configurações do Grok: ${connectionLink}`,
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'Grok on the web cannot be woken from outside: the chosen standby agent answers for it within seconds.',
    wakeNoteWithoutStandby: 'Without a standby agent, Grok on the web sees new messages only when you open the chat.',
    pasteConnector: (connectionLink) => `Paste this address as a connector in the Grok settings: ${connectionLink}`,
  },
};

function wakeNoteOf(input: { text: GrokWebText; standbyAgent: InstallSectionInput['standbyAgent'] }): string {
  if (input.standbyAgent === null) return input.text.wakeNoteWithoutStandby;
  return input.text.wakeNote;
}

function setWakeStep(input: { standbyAgent: InstallSectionInput['standbyAgent'] }): InstallStep {
  const success = 'set_wake returns without an error.';
  if (input.standbyAgent === null) return { action: 'Call `set_wake({mode: "none"})`.', success };
  return { action: `Call \`set_wake({mode: "standby", standby_agent: ${JSON.stringify(input.standbyAgent)}})\`.`, success };
}

export const GROK_WEB_COPY = localizeCopy({
  texts: GROK_WEB_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...GROK_WEB_PRODUCT,
      wakeNote: wakeNoteOf({ text, standbyAgent: section.standbyAgent }),
      steps: [questionStep(text.pasteConnector(section.connectionLink)), setWakeStep(section), chatSelfTest(section.locale)],
    }),
});

const GROK_WEB_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Faça isto no Grok',
  [OwnerLocale.EnglishUs]: 'Do this in Grok',
};

const GROK_WEB_QUICK_START_PATH: Record<OwnerLocale, string[]> = {
  [OwnerLocale.PortugueseBrazil]: ['Abra o Grok → Configurações', 'Adicione um conector', 'Cole este endereço'],
  [OwnerLocale.EnglishUs]: ['Open Grok → Settings', 'Add a connector', 'Paste this address'],
};

export const GROK_WEB_QUICK_START = quickStartOf({ hint: GROK_WEB_QUICK_START_HINT, path: GROK_WEB_QUICK_START_PATH, code: addressText });

import { InstallClient, OwnerLocale } from '@zapbip/types';
import type { InstallSectionInput } from './install-section';
import { chatSelfTest, formatSection, localizeCopy, questionStep, type InstallStep } from './section-format';

type GrokWebText = {
  pasteConnector: (connectionLink: string) => string;
};

const GROK_WEB_TEXT: Record<OwnerLocale, GrokWebText> = {
  [OwnerLocale.PortugueseBrazil]: {
    pasteConnector: (connectionLink) => `Cole este endereço como conector nas configurações do Grok: ${connectionLink}`,
  },
  [OwnerLocale.EnglishUs]: {
    pasteConnector: (connectionLink) => `Paste this address as a connector in the Grok settings: ${connectionLink}`,
  },
};

function setWakeStep(input: { standbyAgent: InstallSectionInput['standbyAgent'] }): InstallStep {
  const success = 'set_wake returns without an error.';
  if (input.standbyAgent === null) return { action: 'Call `set_wake({mode: "none"})`.', success };
  return { action: `Call \`set_wake({mode: "standby", standby_agent: ${JSON.stringify(input.standbyAgent)}})\`.`, success };
}

export const GROK_WEB_COPY = localizeCopy({
  texts: GROK_WEB_TEXT,
  build: ({ section, text }) =>
    formatSection({
      client: InstallClient.GrokWeb,
      locale: section.locale,
      standbyAgent: section.standbyAgent,
      steps: [questionStep(text.pasteConnector(section.connectionLink)), setWakeStep(section), chatSelfTest(section.locale)],
    }),
});

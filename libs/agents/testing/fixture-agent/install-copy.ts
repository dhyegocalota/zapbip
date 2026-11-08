import { INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import type { InstallSectionInput } from '@zapbip/core';

type SectionText = {
  heading: string;
  stopCheck: string;
  stopSuccess: string;
  connect: string;
  connectSuccess: string;
};

const SECTION_TEXT: Record<OwnerLocale, SectionText> = {
  [OwnerLocale.PortugueseBrazil]: {
    heading: 'Fixture Agent',
    stopCheck: 'Se você não é Fixture Agent, pare e não rode nenhum outro passo desta seção.',
    stopSuccess: 'você é Fixture Agent, ou parou.',
    connect: 'Adicione um servidor MCP chamado zapbip em',
    connectSuccess: 'as configurações listam o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    heading: 'Fixture Agent',
    stopCheck: 'If you are not Fixture Agent, stop and run no other step of this section.',
    stopSuccess: 'you are Fixture Agent, or you have stopped.',
    connect: 'Add an MCP server named zapbip at',
    connectSuccess: 'the settings list zapbip.',
  },
};

export function renderFixtureAgentSection(input: InstallSectionInput): string {
  const text = SECTION_TEXT[input.locale];
  const steps = [
    `${text.stopCheck} Success: ${text.stopSuccess}`,
    `${text.connect} ${input.connectionLink}. Success: ${text.connectSuccess}`,
    `In this chat, call send_message with the text "${INSTALL_SELF_TEST_TEXT[input.locale]}". Success: send_message returns without an error.`,
  ];
  return [`## ${text.heading}`, '', ...steps.map((step, index) => `${index + 1}. ${step}`)].join('\n');
}

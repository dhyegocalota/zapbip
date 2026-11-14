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
    heading: 'Fixture Plugin Agent',
    stopCheck: 'If you are not Fixture Plugin Agent, stop and run no other step of this section.',
    stopSuccess: 'você é Fixture Plugin Agent, ou parou.',
    connect: 'Adicione um servidor MCP chamado zapbip em',
    connectSuccess: 'as configurações listam o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    heading: 'Fixture Plugin Agent',
    stopCheck: 'If you are not Fixture Plugin Agent, stop and run no other step of this section.',
    stopSuccess: 'you are Fixture Plugin Agent, or you have stopped.',
    connect: 'Add an MCP server named zapbip at',
    connectSuccess: 'the settings list zapbip.',
  },
  [OwnerLocale.Spanish]: {
    heading: 'Fixture Plugin Agent',
    stopCheck: 'If you are not Fixture Plugin Agent, stop and run no other step of this section.',
    stopSuccess: 'you are Fixture Plugin Agent, or you have stopped.',
    connect: 'Añade un servidor MCP llamado zapbip en',
    connectSuccess: 'los ajustes listan zapbip.',
  },
  [OwnerLocale.German]: {
    heading: 'Fixture Plugin Agent',
    stopCheck: 'If you are not Fixture Plugin Agent, stop and run no other step of this section.',
    stopSuccess: 'you are Fixture Plugin Agent, or you have stopped.',
    connect: 'Füge einen MCP-Server namens zapbip hinzu unter',
    connectSuccess: 'die Einstellungen führen zapbip auf.',
  },
  [OwnerLocale.French]: {
    heading: 'Fixture Plugin Agent',
    stopCheck: 'If you are not Fixture Plugin Agent, stop and run no other step of this section.',
    stopSuccess: 'you are Fixture Plugin Agent, or you have stopped.',
    connect: 'Ajoutez un serveur MCP nommé zapbip à',
    connectSuccess: 'les réglages listent zapbip.',
  },
  [OwnerLocale.Japanese]: {
    heading: 'Fixture Plugin Agent',
    stopCheck: 'If you are not Fixture Plugin Agent, stop and run no other step of this section.',
    stopSuccess: 'you are Fixture Plugin Agent, or you have stopped.',
    connect: 'zapbipという名前のMCPサーバーを次の場所に追加:',
    connectSuccess: '設定にzapbipが表示されている。',
  },
  [OwnerLocale.Korean]: {
    heading: 'Fixture Plugin Agent',
    stopCheck: 'If you are not Fixture Plugin Agent, stop and run no other step of this section.',
    stopSuccess: 'you are Fixture Plugin Agent, or you have stopped.',
    connect: 'zapbip이라는 이름의 MCP 서버를 다음에 추가:',
    connectSuccess: '설정에 zapbip이 표시된다.',
  },
  [OwnerLocale.ChineseSimplified]: {
    heading: 'Fixture Plugin Agent',
    stopCheck: 'If you are not Fixture Plugin Agent, stop and run no other step of this section.',
    stopSuccess: 'you are Fixture Plugin Agent, or you have stopped.',
    connect: '在以下位置添加一个名为 zapbip 的 MCP 服务器：',
    connectSuccess: '设置中列出了 zapbip。',
  },
};

export function renderFixturePluginAgentSection(input: InstallSectionInput): string {
  const text = SECTION_TEXT[input.locale];
  const steps = [
    `${text.stopCheck} Success: ${text.stopSuccess}`,
    `${text.connect} ${input.connectionLink}. Success: ${text.connectSuccess}`,
    `In this chat, call send_message with the text "${INSTALL_SELF_TEST_TEXT[input.locale]}". Success: send_message returns without an error.`,
  ];
  return [`## ${text.heading}`, '', ...steps.map((step, index) => `${index + 1}. ${step}`)].join('\n');
}

import { OwnerLocale } from '@zapbip/types';
import type { AgentInstall } from '../../src/contract';
import { addressText, quickStartOf } from '../../src/quick-start';
import { renderFixtureConnectorAgentSection } from './install-copy';

const FIXTURE_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O agente que os testes usam',
  [OwnerLocale.EnglishUs]: 'The agent the tests use',
  [OwnerLocale.Spanish]: 'El agente que usan las pruebas',
  [OwnerLocale.German]: 'Der Agent, den die Tests verwenden',
  [OwnerLocale.French]: 'L’agent qu’utilisent les tests',
  [OwnerLocale.Japanese]: 'テストで使うエージェント',
  [OwnerLocale.Korean]: '테스트에서 쓰는 에이전트',
  [OwnerLocale.ChineseSimplified]: '测试使用的智能体',
};

const FIXTURE_PATH: Record<OwnerLocale, string[]> = {
  [OwnerLocale.PortugueseBrazil]: ['Abra as configurações', 'Cole este endereço'],
  [OwnerLocale.EnglishUs]: ['Open the settings', 'Paste this address'],
  [OwnerLocale.Spanish]: ['Abre los ajustes', 'Pega esta dirección'],
  [OwnerLocale.German]: ['Öffne die Einstellungen', 'Diese Adresse einfügen'],
  [OwnerLocale.French]: ['Ouvrez les réglages', 'Collez cette adresse'],
  [OwnerLocale.Japanese]: ['設定を開く', 'このアドレスを貼り付ける'],
  [OwnerLocale.Korean]: ['설정 열기', '이 주소 붙여넣기'],
  [OwnerLocale.ChineseSimplified]: ['打开设置', '粘贴这个地址'],
};

export const install: AgentInstall = {
  productName: 'Fixture Connector Agent',
  productDescription: 'Fixture Connector Agent, the agent the tests use',
  officialLogo: null,
  quickStart: ({ locale, connectionLink }) => ({
    hint: FIXTURE_HINT[locale],
    path: FIXTURE_PATH[locale],
    code: connectionLink,
    proof: connectionLink,
  }),
  render: renderFixtureConnectorAgentSection,
};

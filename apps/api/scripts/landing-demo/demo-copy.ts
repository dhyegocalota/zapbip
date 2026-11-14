import { OwnerLocale } from '@zapbip/types';

export type LocaleScript = {
  command: string;
  testsPassed: string;
  question: string;
  terminalQuestion: string;
  options: string[];
  doneText: string;
  liveText: string;
  deployCommand: string;
  optionsLabel: string;
  waitingLabel: string;
  answeredLabel: string;
};

export type RecordedLocale = OwnerLocale.EnglishUs | OwnerLocale.PortugueseBrazil;

export const SCRIPTS: Record<RecordedLocale, LocaleScript> = {
  [OwnerLocale.EnglishUs]: {
    command: 'run the tests',
    testsPassed: '128 tests passed',
    question: 'Tests pass. Deploy v2.4 to production?',
    terminalQuestion: 'Deploy v2.4 to production?',
    options: ['Ship it', 'Wait'],
    doneText: 'Done. v2.4 is live.',
    liveText: 'v2.4 is live',
    deployCommand: 'deploy v2.4',
    optionsLabel: 'options:',
    waitingLabel: 'waiting for your answer',
    answeredLabel: 'owner answered:',
  },
  [OwnerLocale.PortugueseBrazil]: {
    command: 'rode os testes',
    testsPassed: '128 testes passaram',
    question: 'Testes passaram. Publicar a v2.4 em produção?',
    terminalQuestion: 'Publicar a v2.4 em produção?',
    options: ['Publicar', 'Esperar'],
    doneText: 'Pronto. A v2.4 está no ar.',
    liveText: 'v2.4 no ar',
    deployCommand: 'publique a v2.4',
    optionsLabel: 'opções:',
    waitingLabel: 'esperando sua resposta',
    answeredLabel: 'dono respondeu:',
  },
};

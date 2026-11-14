import { OwnerLocale } from '@zapbip/types';
import { SENDER_INDEXES, senderNameOf } from '../../src/site/site-agents';
import { textDirectionOf, type TextDirection } from '../../src/web-shell/locale-profiles';
import { SiteCopyKey } from '../../src/site/site-copy';
import { copyOf } from '../../src/site/site-copy-text';

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

export type DemoOpenGraphData = {
  direction: TextDirection;
  titleLead: string;
  titleAccent: string;
  tagline: string;
  agentName: string;
  questionShort: string;
  options: string[];
};

type TerminalCopy = Pick<
  LocaleScript,
  'command' | 'testsPassed' | 'liveText' | 'deployCommand' | 'optionsLabel' | 'waitingLabel' | 'answeredLabel'
> & {
  questionTemplate: string;
};

const QUESTION_PLACEHOLDER = '{question}';
const TAGLINE_PREFIX = 'zapbip.com · ';

const TERMINAL_COPY: Record<OwnerLocale, TerminalCopy> = {
  [OwnerLocale.EnglishUs]: {
    command: 'run the tests',
    testsPassed: '128 tests passed',
    questionTemplate: `Tests pass. ${QUESTION_PLACEHOLDER}`,
    liveText: 'v2.4 is live',
    deployCommand: 'deploy v2.4',
    optionsLabel: 'options:',
    waitingLabel: 'waiting for your answer',
    answeredLabel: 'owner answered:',
  },
  [OwnerLocale.PortugueseBrazil]: {
    command: 'rode os testes',
    testsPassed: '128 testes passaram',
    questionTemplate: `Testes passaram. ${QUESTION_PLACEHOLDER}`,
    liveText: 'v2.4 no ar',
    deployCommand: 'publique a v2.4',
    optionsLabel: 'opções:',
    waitingLabel: 'esperando sua resposta',
    answeredLabel: 'você respondeu:',
  },
  [OwnerLocale.Spanish]: {
    command: 'ejecuta las pruebas',
    testsPassed: '128 pruebas superadas',
    questionTemplate: `Las pruebas pasaron. ${QUESTION_PLACEHOLDER}`,
    liveText: 'v2.4 en vivo',
    deployCommand: 'despliega la v2.4',
    optionsLabel: 'opciones:',
    waitingLabel: 'esperando tu respuesta',
    answeredLabel: 'tú respondiste:',
  },
  [OwnerLocale.German]: {
    command: 'führe die Tests aus',
    testsPassed: '128 Tests bestanden',
    questionTemplate: `Tests bestanden. ${QUESTION_PLACEHOLDER}`,
    liveText: 'v2.4 ist live',
    deployCommand: 'v2.4 ausrollen',
    optionsLabel: 'Optionen:',
    waitingLabel: 'warte auf deine Antwort',
    answeredLabel: 'du hast geantwortet:',
  },
  [OwnerLocale.French]: {
    command: 'lance les tests',
    testsPassed: '128 tests réussis',
    questionTemplate: `Tests réussis. ${QUESTION_PLACEHOLDER}`,
    liveText: 'v2.4 en ligne',
    deployCommand: 'déploie la v2.4',
    optionsLabel: 'options :',
    waitingLabel: 'en attente de réponse',
    answeredLabel: 'le propriétaire a répondu :',
  },
  [OwnerLocale.Japanese]: {
    command: 'テストを実行して',
    testsPassed: '128件のテストに成功',
    questionTemplate: `テストは成功しました。${QUESTION_PLACEHOLDER}`,
    liveText: 'v2.4が公開されました',
    deployCommand: 'v2.4をデプロイして',
    optionsLabel: '選択肢：',
    waitingLabel: 'あなたの回答を待っています',
    answeredLabel: 'あなたの返信：',
  },
  [OwnerLocale.Korean]: {
    command: '테스트 실행해 줘',
    testsPassed: '테스트 128개 통과',
    questionTemplate: `테스트를 통과했어요. ${QUESTION_PLACEHOLDER}`,
    liveText: 'v2.4 라이브',
    deployCommand: 'v2.4 배포해 줘',
    optionsLabel: '선택지:',
    waitingLabel: '답변을 기다리는 중',
    answeredLabel: '답변:',
  },
  [OwnerLocale.Arabic]: {
    command: 'شغّل الاختبارات',
    testsPassed: 'نجح 128 اختبارًا',
    questionTemplate: `نجحت الاختبارات. ${QUESTION_PLACEHOLDER}`,
    liveText: 'v2.4 يعمل الآن',
    deployCommand: 'انشر v2.4',
    optionsLabel: 'الخيارات:',
    waitingLabel: 'في انتظار ردّك',
    answeredLabel: 'ردّ المالك:',
  },
  [OwnerLocale.ChineseSimplified]: {
    command: '运行测试',
    testsPassed: '128 个测试通过',
    questionTemplate: `测试通过。${QUESTION_PLACEHOLDER}`,
    liveText: 'v2.4 已上线',
    deployCommand: '部署 v2.4',
    optionsLabel: '选项：',
    waitingLabel: '等待你的回复',
    answeredLabel: '你已回复：',
  },
};

export function demoScriptOf(input: { locale: OwnerLocale }): LocaleScript {
  const { locale } = input;
  const translate = copyOf({ locale });
  const { questionTemplate, ...terminal } = TERMINAL_COPY[locale];
  const terminalQuestion = translate(SiteCopyKey.WhyAskQuestion);
  return {
    ...terminal,
    question: questionTemplate.replace(QUESTION_PLACEHOLDER, terminalQuestion),
    terminalQuestion,
    options: [translate(SiteCopyKey.WhyAskShip), translate(SiteCopyKey.WhyAskWait)],
    doneText: translate(SiteCopyKey.WhyAskDone),
  };
}

export function openGraphDataOf(input: { locale: OwnerLocale }): DemoOpenGraphData {
  const { locale } = input;
  const translate = copyOf({ locale });
  const script = demoScriptOf({ locale });
  return {
    direction: textDirectionOf({ locale }),
    titleLead: translate(SiteCopyKey.HeroTitleLead),
    titleAccent: translate(SiteCopyKey.HeroTitleAccent),
    tagline: `${TAGLINE_PREFIX}${translate(SiteCopyKey.FinalButton)}`,
    agentName: senderNameOf({ index: SENDER_INDEXES.first }),
    questionShort: script.question,
    options: script.options,
  };
}

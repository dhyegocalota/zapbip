import { WebLocale } from '@zapbip/types';

export type OpenGraphPhoneCopy = { question: string; options: string[] };

const BUTTON_LABELS = ['Ship it', 'Wait'];

export const OPEN_GRAPH_PHONE_COPY: Partial<Record<WebLocale, OpenGraphPhoneCopy>> = {
  [WebLocale.Spanish]: { question: '¿Desplegar la v2.4 en producción?', options: BUTTON_LABELS },
  [WebLocale.German]: { question: 'v2.4 in Produktion ausrollen?', options: BUTTON_LABELS },
  [WebLocale.French]: { question: 'Déployer la v2.4 en production ?', options: BUTTON_LABELS },
  [WebLocale.Japanese]: { question: 'v2.4を本番環境にデプロイしますか？', options: BUTTON_LABELS },
  [WebLocale.Korean]: { question: 'v2.4를 프로덕션에 배포할까요?', options: BUTTON_LABELS },
  [WebLocale.ChineseSimplified]: { question: '要把 v2.4 部署到生产环境吗？', options: BUTTON_LABELS },
};

import { OwnerLocale } from '@zapbip/types';

export type StartLinkTexts = {
  htmlLanguage: string;
  unavailableTitle: string;
  unavailableBody: string;
};

export const START_LINK_COPY: Record<OwnerLocale, StartLinkTexts> = {
  [OwnerLocale.PortugueseBrazil]: {
    htmlLanguage: 'pt-BR',
    unavailableTitle: 'zapbip: voltamos já',
    unavailableBody: 'No momento não estamos aceitando novos cadastros. Tente de novo em alguns minutos.',
  },
  [OwnerLocale.EnglishUs]: {
    htmlLanguage: 'en-US',
    unavailableTitle: 'zapbip: back soon',
    unavailableBody: 'We are not taking new sign-ups right now. Please try again in a few minutes.',
  },
  [OwnerLocale.Spanish]: {
    htmlLanguage: 'es-ES',
    unavailableTitle: 'zapbip: volvemos enseguida',
    unavailableBody: 'Ahora mismo no aceptamos registros nuevos. Inténtalo de nuevo en unos minutos.',
  },
  [OwnerLocale.German]: {
    htmlLanguage: 'de-DE',
    unavailableTitle: 'zapbip: gleich wieder da',
    unavailableBody: 'Wir nehmen gerade keine neuen Anmeldungen an. Bitte versuche es in ein paar Minuten erneut.',
  },
  [OwnerLocale.French]: {
    htmlLanguage: 'fr-FR',
    unavailableTitle: 'zapbip\u00a0: de retour bientôt',
    unavailableBody: 'Nous n’acceptons pas de nouvelles inscriptions pour le moment. Réessayez dans quelques minutes.',
  },
  [OwnerLocale.Japanese]: {
    htmlLanguage: 'ja-JP',
    unavailableTitle: 'zapbip: まもなく再開します',
    unavailableBody: '現在、新規登録を受け付けていません。数分後にもう一度お試しください。',
  },
  [OwnerLocale.Korean]: {
    htmlLanguage: 'ko-KR',
    unavailableTitle: 'zapbip: 곧 돌아옵니다',
    unavailableBody: '지금은 새 가입을 받지 않습니다. 몇 분 뒤에 다시 시도해 주세요.',
  },
  [OwnerLocale.ChineseSimplified]: {
    htmlLanguage: 'zh-CN',
    unavailableTitle: 'zapbip：马上回来',
    unavailableBody: '目前不接受新的注册。请过几分钟再试。',
  },
  [OwnerLocale.Arabic]: {
    htmlLanguage: 'ar',
    unavailableTitle: 'zapbip: سنعود قريبًا',
    unavailableBody: 'لا نستقبل تسجيلات جديدة الآن. حاول مرة أخرى بعد بضع دقائق.',
  },
};

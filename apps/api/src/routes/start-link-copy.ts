import { OwnerLocale } from '@zapbip/types';

export type StartLinkTexts = {
  htmlLanguage: string;
  direction: 'ltr' | 'rtl';
  unavailableTitle: string;
  unavailableBody: string;
};

export const START_LINK_COPY: Record<OwnerLocale, StartLinkTexts> = {
  [OwnerLocale.PortugueseBrazil]: {
    htmlLanguage: 'pt-BR',
    direction: 'ltr',
    unavailableTitle: 'zapbip: voltamos já',
    unavailableBody: 'No momento não estamos aceitando novos cadastros. Tente de novo em alguns minutos.',
  },
  [OwnerLocale.EnglishUs]: {
    htmlLanguage: 'en-US',
    direction: 'ltr',
    unavailableTitle: 'zapbip: back soon',
    unavailableBody: 'We are not taking new sign-ups right now. Please try again in a few minutes.',
  },
  [OwnerLocale.Spanish]: {
    htmlLanguage: 'es-ES',
    direction: 'ltr',
    unavailableTitle: 'zapbip: volvemos enseguida',
    unavailableBody: 'Ahora mismo no aceptamos registros nuevos. Inténtalo de nuevo en unos minutos.',
  },
  [OwnerLocale.German]: {
    htmlLanguage: 'de-DE',
    direction: 'ltr',
    unavailableTitle: 'zapbip: gleich wieder da',
    unavailableBody: 'Wir nehmen gerade keine neuen Anmeldungen an. Bitte versuche es in ein paar Minuten erneut.',
  },
  [OwnerLocale.French]: {
    htmlLanguage: 'fr-FR',
    direction: 'ltr',
    unavailableTitle: 'zapbip\u00a0: de retour bientôt',
    unavailableBody: 'Nous n’acceptons pas de nouvelles inscriptions pour le moment. Réessayez dans quelques minutes.',
  },
  [OwnerLocale.Japanese]: {
    htmlLanguage: 'ja-JP',
    direction: 'ltr',
    unavailableTitle: 'zapbip: まもなく再開します',
    unavailableBody: '現在、新規登録を受け付けていません。数分後にもう一度お試しください。',
  },
  [OwnerLocale.Korean]: {
    htmlLanguage: 'ko-KR',
    direction: 'ltr',
    unavailableTitle: 'zapbip: 곧 돌아와요',
    unavailableBody: '지금은 새 가입을 받지 않아요. 몇 분 뒤에 다시 시도해 주세요.',
  },
  [OwnerLocale.ChineseSimplified]: {
    htmlLanguage: 'zh-CN',
    direction: 'ltr',
    unavailableTitle: 'zapbip：马上回来',
    unavailableBody: '目前不接受新的注册。请过几分钟再试。',
  },
  [OwnerLocale.Arabic]: {
    htmlLanguage: 'ar',
    direction: 'rtl',
    unavailableTitle: 'zapbip: سنعود قريبًا',
    unavailableBody: 'لا نستقبل تسجيلات جديدة الآن. حاول مرة أخرى بعد بضع دقائق.',
  },
  [OwnerLocale.Hindi]: {
    htmlLanguage: 'hi',
    direction: 'ltr',
    unavailableTitle: 'zapbip: जल्द वापस आएँगे',
    unavailableBody: 'अभी हम नए साइन-अप नहीं ले रहे हैं। कृपया कुछ मिनट बाद फिर से कोशिश करें।',
  },
};

import { OwnerLocale } from '@zapbip/types';
import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';
import { ARABIC_WELCOME_EMAIL_COPY } from './welcome-email-copy-arabic';
import { CHINESE_WELCOME_EMAIL_COPY } from './welcome-email-copy-chinese';
import { FRENCH_WELCOME_EMAIL_COPY } from './welcome-email-copy-french';
import { GERMAN_WELCOME_EMAIL_COPY } from './welcome-email-copy-german';
import { JAPANESE_WELCOME_EMAIL_COPY } from './welcome-email-copy-japanese';
import { KOREAN_WELCOME_EMAIL_COPY } from './welcome-email-copy-korean';
import { SPANISH_WELCOME_EMAIL_COPY } from './welcome-email-copy-spanish';

export { WelcomeEmailCopyKey };

type CopyEntries = Record<WelcomeEmailCopyKey, string>;

const ENGLISH_COPY: CopyEntries = {
  [WelcomeEmailCopyKey.Subject]: "You're on the zapbip early access list",
  [WelcomeEmailCopyKey.Preview]: "Thanks for asking. Here's what happens next.",
  [WelcomeEmailCopyKey.Heading]: 'Thanks for requesting access to zapbip',
  [WelcomeEmailCopyKey.Intro]:
    'zapbip lets your AI agents text you on WhatsApp: they ask with buttons, wait for your answer, then keep working.',
  [WelcomeEmailCopyKey.Waves]:
    "Access opens in waves, in the order people asked. When it's your turn, we'll let you know by email or on WhatsApp. Nothing else to do until then.",
  [WelcomeEmailCopyKey.StartLead]: 'Once your access opens, this link starts your first conversation with zapbip on WhatsApp.',
  [WelcomeEmailCopyKey.StartAction]: 'Start on WhatsApp',
  [WelcomeEmailCopyKey.DocsLead]: 'Curious how it works? The docs show how to connect your first agent.',
  [WelcomeEmailCopyKey.DocsAction]: 'Read the docs',
  [WelcomeEmailCopyKey.ReferralLead]: 'Know someone who would like it? Share your link:',
  [WelcomeEmailCopyKey.Signoff]: 'See you on WhatsApp.',
  [WelcomeEmailCopyKey.SignoffTeam]: 'The zapbip team',
  [WelcomeEmailCopyKey.Footer]:
    "You're getting this email because {email} joined the zapbip waitlist. zapbip is made by {company}. Questions? Just reply to this email.",
};

const PORTUGUESE_COPY: CopyEntries = {
  [WelcomeEmailCopyKey.Subject]: 'Você está na lista de acesso antecipado do zapbip',
  [WelcomeEmailCopyKey.Preview]: 'Obrigado pelo pedido. Veja o que acontece agora.',
  [WelcomeEmailCopyKey.Heading]: 'Obrigado por pedir acesso ao zapbip',
  [WelcomeEmailCopyKey.Intro]:
    'Com o zapbip, seus agentes de IA falam com você no WhatsApp: perguntam com botões, esperam sua resposta e continuam o trabalho.',
  [WelcomeEmailCopyKey.Waves]:
    'O acesso é liberado aos poucos, na ordem dos pedidos. Quando chegar a sua vez, avisamos você por e-mail ou pelo WhatsApp. Até lá, não precisa fazer mais nada.',
  [WelcomeEmailCopyKey.StartLead]: 'Quando seu acesso for liberado, este link abre sua primeira conversa com o zapbip no WhatsApp.',
  [WelcomeEmailCopyKey.StartAction]: 'Começar no WhatsApp',
  [WelcomeEmailCopyKey.DocsLead]: 'Quer ver como funciona? A documentação mostra como conectar seu primeiro agente.',
  [WelcomeEmailCopyKey.DocsAction]: 'Ler a documentação',
  [WelcomeEmailCopyKey.ReferralLead]: 'Conhece alguém que vai gostar? Compartilhe seu link:',
  [WelcomeEmailCopyKey.Signoff]: 'Até breve no WhatsApp.',
  [WelcomeEmailCopyKey.SignoffTeam]: 'Equipe zapbip',
  [WelcomeEmailCopyKey.Footer]:
    'Você recebeu este e-mail porque {email} entrou na lista de espera do zapbip. O zapbip é feito pela {company}. Dúvidas? É só responder este e-mail.',
};

const WELCOME_EMAIL_COPY: Record<OwnerLocale, CopyEntries> = {
  [OwnerLocale.EnglishUs]: ENGLISH_COPY,
  [OwnerLocale.PortugueseBrazil]: PORTUGUESE_COPY,
  [OwnerLocale.Spanish]: SPANISH_WELCOME_EMAIL_COPY,
  [OwnerLocale.German]: GERMAN_WELCOME_EMAIL_COPY,
  [OwnerLocale.French]: FRENCH_WELCOME_EMAIL_COPY,
  [OwnerLocale.Japanese]: JAPANESE_WELCOME_EMAIL_COPY,
  [OwnerLocale.Korean]: KOREAN_WELCOME_EMAIL_COPY,
  [OwnerLocale.ChineseSimplified]: CHINESE_WELCOME_EMAIL_COPY,
  [OwnerLocale.Arabic]: ARABIC_WELCOME_EMAIL_COPY,
};

export function renderWelcomeEmailCopy(input: { key: WelcomeEmailCopyKey; locale: OwnerLocale; values?: Record<string, string> }): string {
  const { key, locale, values = {} } = input;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), WELCOME_EMAIL_COPY[locale][key]);
}

export function welcomeCopyOf(input: { locale: OwnerLocale }): (key: WelcomeEmailCopyKey, values?: Record<string, string>) => string {
  return (key, values) => renderWelcomeEmailCopy({ key, locale: input.locale, values });
}

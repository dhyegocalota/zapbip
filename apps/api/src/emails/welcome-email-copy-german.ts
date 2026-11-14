import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';

export const GERMAN_WELCOME_EMAIL_COPY: Record<WelcomeEmailCopyKey, string> = {
  [WelcomeEmailCopyKey.Subject]: 'Du stehst auf der Liste für den frühen Zugang zu zapbip',
  [WelcomeEmailCopyKey.Preview]: 'Danke für deine Anfrage. So geht es weiter.',
  [WelcomeEmailCopyKey.Heading]: 'Danke, dass du Zugang zu zapbip angefragt hast',
  [WelcomeEmailCopyKey.Intro]:
    'Mit zapbip schreiben dir deine KI-Agenten auf WhatsApp: Sie fragen per Button, warten auf deine Antwort und arbeiten dann weiter.',
  [WelcomeEmailCopyKey.Waves]:
    'Wir schalten den Zugang in Wellen frei, in der Reihenfolge der Anfragen. Sobald du dran bist, sagen wir dir per E-Mail oder auf WhatsApp Bescheid. Bis dahin musst du nichts tun.',
  [WelcomeEmailCopyKey.StartLead]:
    'Sobald dein Zugang freigeschaltet ist, startet dieser Link dein erstes Gespräch mit zapbip auf WhatsApp.',
  [WelcomeEmailCopyKey.StartAction]: 'Auf WhatsApp starten',
  [WelcomeEmailCopyKey.DocsLead]: 'Neugierig, wie es funktioniert? Die Doku zeigt, wie du deinen ersten Agenten verbindest.',
  [WelcomeEmailCopyKey.DocsAction]: 'Zur Doku',
  [WelcomeEmailCopyKey.ReferralLead]: 'Kennst du jemanden, dem das gefallen würde? Teile deinen Link:',
  [WelcomeEmailCopyKey.Signoff]: 'Bis bald auf WhatsApp.',
  [WelcomeEmailCopyKey.SignoffTeam]: 'Dein zapbip-Team',
  [WelcomeEmailCopyKey.Footer]:
    'Du bekommst diese E-Mail, weil sich {email} auf die Warteliste von zapbip gesetzt hat. zapbip ist ein Produkt von {company}. Fragen? Antworte einfach auf diese E-Mail.',
};

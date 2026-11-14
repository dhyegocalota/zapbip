import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';

export const FRENCH_WELCOME_EMAIL_COPY: Record<WelcomeEmailCopyKey, string> = {
  [WelcomeEmailCopyKey.Subject]: 'Vous êtes sur la liste d’accès anticipé de zapbip',
  [WelcomeEmailCopyKey.Preview]: 'Merci pour votre demande. Voici la suite.',
  [WelcomeEmailCopyKey.Heading]: 'Merci d’avoir demandé l’accès à zapbip',
  [WelcomeEmailCopyKey.Intro]:
    'Avec zapbip, vos agents IA vous écrivent sur WhatsApp : ils posent leurs questions avec des boutons, attendent votre réponse, puis reprennent le travail.',
  [WelcomeEmailCopyKey.Waves]:
    'Nous ouvrons l’accès par vagues, dans l’ordre des demandes. Quand ce sera votre tour, nous vous préviendrons par e-mail ou sur WhatsApp. D’ici là, rien d’autre à faire.',
  [WelcomeEmailCopyKey.StartLead]: 'Dès que votre accès sera activé, ce lien lancera votre première conversation avec zapbip sur WhatsApp.',
  [WelcomeEmailCopyKey.StartAction]: 'Commencer sur WhatsApp',
  [WelcomeEmailCopyKey.DocsLead]: 'Envie de voir comment ça marche ? La documentation explique comment connecter votre premier agent.',
  [WelcomeEmailCopyKey.DocsAction]: 'Lire la documentation',
  [WelcomeEmailCopyKey.ReferralLead]: 'Vous connaissez quelqu’un que ça intéresserait ? Partagez votre lien :',
  [WelcomeEmailCopyKey.Signoff]: 'À bientôt sur WhatsApp.',
  [WelcomeEmailCopyKey.SignoffTeam]: 'L’équipe zapbip',
  [WelcomeEmailCopyKey.Footer]:
    'Vous recevez cet e-mail parce que {email} a rejoint la liste d’attente de zapbip. zapbip est un produit de {company}. Une question ? Répondez simplement à cet e-mail.',
};

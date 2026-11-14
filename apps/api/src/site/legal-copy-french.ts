import { LegalDocument } from './legal-links';
import type { LegalText } from './legal-copy';

export const FRENCH_LEGAL_COPY: Record<LegalDocument, LegalText> = {
  [LegalDocument.Terms]: {
    title: 'Conditions d’utilisation',
    description: 'Les règles d’utilisation de zapbip, le canal WhatsApp de vos agents IA, conçu par Logic Bit au Brésil.',
    summary:
      'Ces conditions constituent l’accord entre vous et {tradeName} pour l’utilisation de zapbip. En rejoignant la liste d’attente ou en écrivant à zapbip sur WhatsApp, vous les acceptez.',
    updated: 'Dernière mise à jour\u00a0: {updatedOn}',
    sections: [
      {
        heading: 'Qui nous sommes',
        paragraphs: [
          'zapbip est un service de {tradeName}, nom commercial de {legalName}, CNPJ {cnpj}, {address}. Contact\u00a0: {contactEmail}.',
        ],
        items: [],
      },
      {
        heading: 'Ce que fait zapbip',
        paragraphs: [
          'zapbip relie les agents IA de votre choix, comme {agents} ou tout client MCP, à votre propre WhatsApp via la plateforme officielle WhatsApp Business de Meta. Vos agents peuvent vous envoyer des messages, vous poser des questions et recevoir vos réponses. zapbip ne parle qu’à vous et n’écrit jamais à vos contacts ni à personne d’autre.',
          'zapbip est en accès anticipé. Les comptes s’ouvrent sur invitation depuis la liste d’attente, et les fonctionnalités peuvent évoluer en cours de route.',
        ],
        items: [],
      },
      {
        heading: 'Votre compte',
        paragraphs: [],
        items: [
          'Votre compte est votre numéro WhatsApp. Vous vous connectez en écrivant à zapbip\u202f; il n’y a pas de mot de passe.',
          'Les messages vous parviennent depuis un numéro zapbip. Connecter votre propre numéro comme expéditeur n’est pas encore possible.',
          'Vous devez avoir au moins 18 ans et la capacité de conclure un contrat.',
          'Gardez secrète la clé de chaque agent. Quiconque détient une clé peut vous écrire en se faisant passer pour cet agent\u202f; révoquez-la donc immédiatement en cas de fuite.',
          'Vous êtes responsable de ce qui se passe via votre compte et vos agents.',
        ],
      },
      {
        heading: 'Vos agents',
        paragraphs: [
          'Vos agents sont des logiciels que vous choisissez et exécutez. zapbip achemine leurs messages et vos réponses, mais n’écrit, ne vérifie ni ne contrôle ce qu’ils disent ou font. Ce que vous décidez à partir d’un message d’agent, comme une réponse par bouton, relève de votre décision. Les fournisseurs d’IA derrière vos agents ont leurs propres conditions.',
        ],
        items: [],
      },
      {
        heading: 'Utilisation acceptable',
        paragraphs: [
          'Nous pouvons suspendre ou fermer un compte qui enfreint ces règles, et signaler toute activité illégale aux autorités.',
        ],
        items: [
          'Utilisez zapbip uniquement pour échanger avec vos propres agents.',
          'N’envoyez ni spam, ni contenu illégal, ni contenu contraire aux politiques WhatsApp Business de Meta.',
          'N’essayez pas de joindre d’autres personnes via zapbip, de contourner ses limites, ni de pénétrer dans le service ou dans d’autres comptes.',
          'Ne revendez pas zapbip et ne le surchargez pas.',
        ],
      },
      {
        heading: 'Offres et tarifs',
        paragraphs: [
          'L’offre Gratuit comprend {free} messages pour essayer zapbip, sans frais. Les offres payantes et les tarifs du site ne s’appliquent qu’à l’ouverture de la facturation, et vous verrez et accepterez un prix avant de payer quoi que ce soit. Nous vous préviendrons à l’avance de tout changement de tarif qui vous concerne.',
        ],
        items: [],
      },
      {
        heading: 'Disponibilité',
        paragraphs: [
          'Nous nous efforçons de maintenir zapbip en service, mais il est fourni en l’état, sans garantie de disponibilité permanente ni de remise de chaque message. Il dépend de Meta, de Cloudflare et d’Internet. N’utilisez pas zapbip pour des urgences ni pour tout usage où un message tardif ou perdu pourrait causer un dommage.',
        ],
        items: [],
      },
      {
        heading: 'Responsabilité',
        paragraphs: [
          'Dans la mesure permise par le droit brésilien, {tradeName} n’est pas responsable des dommages indirects, des pertes de bénéfices ni des préjudices causés par vos agents, par des services tiers ou par des messages retardés ou non remis. Rien dans ces conditions ne limite les droits que vous confèrent le Code brésilien de défense du consommateur (loi 8.078/1990) ou toute autre loi à laquelle il est impossible de renoncer.',
        ],
        items: [],
      },
      {
        heading: 'Fin de votre compte',
        paragraphs: [
          'Vous pouvez supprimer votre compte à tout moment en envoyant «\u202fsupprimer le compte\u202f» à zapbip sur WhatsApp. Nous pouvons fermer un compte qui enfreint ces conditions, ou mettre fin au service moyennant préavis. La politique de confidentialité explique ce qu’il advient de vos données.',
        ],
        items: [],
      },
      {
        heading: 'Modifications de ces conditions',
        paragraphs: [
          'Nous pouvons mettre à jour ces conditions\u202f; la date en haut indique la version en vigueur. Nous vous préviendrons sur WhatsApp ou sur ce site avant l’entrée en vigueur d’un changement important. Continuer à utiliser zapbip ensuite vaut acceptation des nouvelles conditions.',
        ],
        items: [],
      },
      {
        heading: 'Droit applicable et tribunaux',
        paragraphs: [
          'Ces conditions sont régies par le droit brésilien. Les litiges relèvent des tribunaux de Belo Horizonte, Minas Gerais, sauf si la loi vous permet, en tant que consommateur, de saisir les tribunaux de votre lieu de résidence. Ces conditions sont rédigées en portugais et traduites en français\u202f; en cas de divergence entre les deux versions, la version portugaise prévaut.',
        ],
        items: [],
      },
      { heading: 'Contact', paragraphs: ['Questions sur ces conditions\u00a0: {contactEmail}.'], items: [] },
    ],
  },
  [LegalDocument.Privacy]: {
    title: 'Politique de confidentialité',
    description:
      'Ce que zapbip collecte, pourquoi, pendant combien de temps, et vos droits au titre de la loi générale brésilienne sur la protection des données (LGPD).',
    summary:
      'zapbip ne conserve que ce qui est nécessaire pour acheminer les messages entre vous et vos agents, et supprime chaque donnée après un délai fixe. Cette politique suit la loi générale brésilienne sur la protection des données (loi 13.709/2018, la LGPD).',
    updated: 'Dernière mise à jour\u00a0: {updatedOn}',
    sections: [
      {
        heading: 'Qui est responsable',
        paragraphs: [
          '{tradeName} ({legalName}, CNPJ {cnpj}, {address}) est le responsable du traitement de vos données personnelles. Notre délégué à la protection des données est joignable à l’adresse {contactEmail}.',
        ],
        items: [],
      },
      {
        heading: 'Ce que nous collectons',
        paragraphs: [],
        items: [
          'Liste d’attente\u00a0: votre e-mail, la langue de la page et les données de parrainage (qui vous a invité et combien de personnes vous avez invitées). Aucune adresse IP n’est conservée avec ces données.',
          'Compte\u00a0: votre numéro WhatsApp, votre langue et la date de votre inscription.',
          'Agents\u00a0: le nom de chaque agent que vous connectez, l’application dans laquelle il s’exécute lorsque celle-ci nous l’indique, la date de sa création et celle de sa dernière activité. La clé de chaque agent n’est conservée que sous forme d’empreinte.',
          'Messages\u00a0: les textes, questions, boutons et réponses échangés entre vous et vos agents, ainsi que les photos et fichiers que vous échangez.',
          'Application web\u00a0: un cookie de session lorsque vous vous connectez sur app.zapbip.com.',
          'Données techniques\u00a0: lorsque vous utilisez le site ou le service, Cloudflare, notre hébergeur, traite des données de requête, comme votre adresse IP, pour le fournir et le protéger.',
        ],
      },
      {
        heading: 'Pourquoi nous les utilisons',
        paragraphs: [
          'Nous ne vendons pas vos données, nous n’affichons aucune publicité et nous n’utilisons pas vos messages pour entraîner des modèles d’IA.',
        ],
        items: [
          'Pour fournir le service que vous avez demandé\u00a0: acheminer les messages entre vous et vos agents et gérer votre compte (LGPD, article 7, V).',
          'Pour gérer la liste d’attente et vous envoyer votre invitation, avec le consentement que vous donnez en vous inscrivant (article 7, I).',
          'Pour assurer la sécurité de zapbip et prévenir les abus, par exemple avec le captcha du formulaire de la liste d’attente et les limites de fréquence (intérêt légitime, article 7, IX).',
          'Pour respecter des obligations légales (article 7, II).',
        ],
      },
      {
        heading: 'Combien de temps nous les conservons',
        paragraphs: ['Les journaux ne contiennent jamais le texte de vos messages.'],
        items: [
          'Messages et questions en attente pour vous ou pour un agent\u00a0: {messageDays} jours.',
          'Photos et fichiers\u00a0: {mediaDays} jours.',
          'Session de l’application web\u00a0: jusqu’à {sessionDays} jours, ou jusqu’à votre déconnexion.',
          'Compte et agents\u00a0: jusqu’à la suppression de votre compte.',
          'Liste d’attente\u00a0: jusqu’à l’obtention de votre accès ou jusqu’à votre demande de retrait.',
        ],
      },
      {
        heading: 'Avec qui nous les partageons',
        paragraphs: [
          'Nous ne partageons des données qu’avec les prestataires qui font fonctionner zapbip. Vos agents reçoivent les messages que vous leur envoyez\u202f; ils s’exécutent sous votre contrôle et selon les conditions de leurs propres fournisseurs. Nous pouvons aussi divulguer des données lorsque la loi ou un tribunal l’exige.',
        ],
        items: [
          'Meta Platforms, via la plateforme officielle WhatsApp Business, qui achemine chaque message WhatsApp.',
          'Cloudflare, qui héberge le service et son stockage et exécute le captcha (Turnstile) du formulaire de la liste d’attente.',
          'Mintlify, qui héberge la documentation sur docs.zapbip.com.',
        ],
      },
      {
        heading: 'Transfert international',
        paragraphs: [
          'Meta et Cloudflare traitent des données sur des serveurs situés hors du Brésil, notamment aux États-Unis. Ces transferts sont nécessaires à la fourniture du service et respectent les garanties de la LGPD (article 33).',
        ],
        items: [],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'Le site ne dépose que deux cookies qui lui sont propres, pour mémoriser votre langue et votre thème, et l’application web dépose un cookie de session lorsque vous vous connectez. Il n’y a aucun cookie publicitaire ni de suivi.',
        ],
        items: [],
      },
      {
        heading: 'Vos droits',
        paragraphs: [
          'Pour supprimer votre compte et tout ce qu’il contient, envoyez «\u202fsupprimer le compte\u202f» à zapbip sur WhatsApp. Pour toute autre demande, écrivez à {contactEmail}\u202f; nous répondons sous 15 jours.',
        ],
        items: [
          'Savoir si nous traitons vos données et y accéder.',
          'Faire corriger des données incomplètes ou erronées.',
          'Demander l’anonymisation, le blocage ou la suppression des données inutiles.',
          'Demander le transfert de vos données à un autre fournisseur.',
          'Savoir avec qui nous les partageons.',
          'Retirer votre consentement à tout moment.',
          'Déposer une réclamation auprès de l’Autorité nationale brésilienne de protection des données (ANPD).',
        ],
      },
      {
        heading: 'Ce que conservent Meta et Cloudflare',
        paragraphs: [
          'Lorsque vous supprimez votre compte, Meta conserve la conversation WhatsApp de son côté et Cloudflare conserve des copies de sauvegarde, chacun pendant sa propre durée de conservation. Supprimez la conversation dans WhatsApp pour la retirer de votre téléphone.',
        ],
        items: [],
      },
      {
        heading: 'Sécurité',
        paragraphs: [
          'Toutes les connexions utilisent HTTPS. Les clés des agents et les sessions de l’application web ne sont conservées que sous forme d’empreintes, et chaque agent a sa propre clé, que vous pouvez révoquer à tout moment.',
        ],
        items: [],
      },
      {
        heading: 'Enfants',
        paragraphs: ['zapbip n’est pas destiné aux personnes de moins de 18 ans, et nous ne collectons pas sciemment leurs données.'],
        items: [],
      },
      {
        heading: 'Modifications de cette politique',
        paragraphs: [
          'Nous pouvons mettre à jour cette politique\u202f; la date en haut indique la version en vigueur, et nous vous préviendrons avant l’entrée en vigueur d’un changement important. Cette politique est rédigée en portugais et traduite en français\u202f; en cas de divergence entre les deux versions, la version portugaise prévaut.',
        ],
        items: [],
      },
    ],
  },
};

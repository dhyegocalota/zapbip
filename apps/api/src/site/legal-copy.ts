import { MEDIA_RETENTION_MS, QUEUE_RETENTION_MS } from '@zapbip/core';
import { CLIENT_APP_SESSION_TTL_MS, COMPANY, DAY_MS, OwnerLocale, PRICING_FREE_MESSAGES } from '@zapbip/types';
import { LegalDocument } from './legal-links';
import { SPANISH_LEGAL_COPY } from './legal-copy-spanish';
import { GERMAN_LEGAL_COPY } from './legal-copy-german';
import { FRENCH_LEGAL_COPY } from './legal-copy-french';
import { JAPANESE_LEGAL_COPY } from './legal-copy-japanese';
import { KOREAN_LEGAL_COPY } from './legal-copy-korean';
import { ARABIC_LEGAL_COPY } from './legal-copy-arabic';
import { CHINESE_LEGAL_COPY } from './legal-copy-chinese';
import { formatCount } from './price-format';
import { leadingAgentNames } from './site-agents';
import { LEGAL_UPDATED_ON } from './site-constants';
import { formattingLocaleOf } from '../web-shell/locale-profiles';

export type LegalSection = { heading: string; paragraphs: string[]; items: string[] };
export type LegalText = { title: string; description: string; summary: string; updated: string; sections: LegalSection[] };

const ARABIC_PLURAL_LOCALE = 'ar';
const UTC_TIME_ZONE = 'UTC';

const LEGAL_COPY: Record<LegalDocument, Record<OwnerLocale, LegalText>> = {
  [LegalDocument.Terms]: {
    [OwnerLocale.EnglishUs]: {
      title: 'Terms of use',
      description: 'The rules for using zapbip, the WhatsApp channel for your AI agents, made by Logic Bit in Brazil.',
      summary:
        'These terms are the agreement between you and {tradeName} for the use of zapbip. By joining the waitlist or messaging zapbip on WhatsApp, you accept them.',
      updated: 'Last updated: {updatedOn}',
      sections: [
        {
          heading: 'Who we are',
          paragraphs: [
            'zapbip is a service of {tradeName}, the trade name of {legalName}, CNPJ {cnpj}, {address}. Contact: {contactEmail}.',
          ],
          items: [],
        },
        {
          heading: 'What zapbip does',
          paragraphs: [
            "zapbip connects the AI agents you choose, such as {agents} or any MCP client, to your own WhatsApp through Meta's official WhatsApp Business Platform. Your agents can send you messages, ask you questions and receive your replies. zapbip talks only to you and never messages your contacts or anyone else.",
            'zapbip is in early access. Accounts open by invitation from the waitlist, and features may change along the way.',
          ],
          items: [],
        },
        {
          heading: 'Your account',
          paragraphs: [],
          items: [
            'Your account is your WhatsApp number. You sign in by messaging zapbip; there is no password.',
            'Messages reach you from a zapbip number. Connecting your own number as the sender is not available yet.',
            'You must be at least 18 years old and able to enter into a contract.',
            'Keep the key of each agent secret. Anyone holding a key can message you as that agent, so revoke it at once if it leaks.',
            'You are responsible for what happens through your account and your agents.',
          ],
        },
        {
          heading: 'Your agents',
          paragraphs: [
            'Your agents are software you choose and run. zapbip delivers their messages and your replies, but it does not write, check or control what they say or do. What you decide from an agent message, such as a tap on a button, is your decision. The AI providers behind your agents have their own terms.',
          ],
          items: [],
        },
        {
          heading: 'Acceptable use',
          paragraphs: [
            'We may suspend or close an account that breaks these rules, and we may report illegal activity to the authorities.',
          ],
          items: [
            'Use zapbip only to talk with your own agents.',
            "Do not send spam, illegal content or content that breaks Meta's WhatsApp Business policies.",
            'Do not try to reach other people through zapbip, get around its limits, or break into the service or other accounts.',
            'Do not resell zapbip or overload it.',
          ],
        },
        {
          heading: 'Plans and prices',
          paragraphs: [
            'The Free plan includes {free} messages to try zapbip, at no cost. The paid plans and prices on the site apply only once billing opens, and you will see and accept a price before you pay anything. We will tell you in advance about any price change that affects you.',
          ],
          items: [],
        },
        {
          heading: 'Availability',
          paragraphs: [
            'We work to keep zapbip running, but it is provided as it is, with no guarantee that it will always be available or that every message will be delivered. It depends on Meta, on Cloudflare and on the internet. Do not use zapbip for emergencies or for anything where a late or lost message could cause harm.',
          ],
          items: [],
        },
        {
          heading: 'Liability',
          paragraphs: [
            'To the extent Brazilian law allows, {tradeName} is not liable for indirect damages, lost profits, or losses caused by your agents, by third-party services or by messages that were late or not delivered. Nothing in these terms limits the rights you have under the Brazilian Consumer Defense Code (Law 8,078/1990) or any other law that cannot be waived.',
          ],
          items: [],
        },
        {
          heading: 'Ending your account',
          paragraphs: [
            'You can delete your account at any time by sending "delete account" to zapbip on WhatsApp. We may close an account that breaks these terms, or end the service with notice. The privacy policy explains what happens to your data.',
          ],
          items: [],
        },
        {
          heading: 'Changes to these terms',
          paragraphs: [
            'We may update these terms; the date at the top shows the current version. We will tell you on WhatsApp or on this site before a change that matters takes effect. Using zapbip after that means you accept the new terms.',
          ],
          items: [],
        },
        {
          heading: 'Law and courts',
          paragraphs: [
            'These terms follow the laws of Brazil. Disputes go to the courts of Belo Horizonte, Minas Gerais, unless the law lets you, as a consumer, use the courts where you live. These terms are written in Portuguese and in English; if the two differ, the Portuguese version prevails.',
          ],
          items: [],
        },
        {
          heading: 'Contact',
          paragraphs: ['Questions about these terms: {contactEmail}.'],
          items: [],
        },
      ],
    },
    [OwnerLocale.PortugueseBrazil]: {
      title: 'Termos de uso',
      description: 'As regras de uso do zapbip, o canal de WhatsApp para seus agentes de IA, feito pela Logic Bit no Brasil.',
      summary:
        'Estes termos são o acordo entre você e a {tradeName} para o uso do zapbip. Ao entrar na lista de espera ou mandar mensagem para o zapbip no WhatsApp, você os aceita.',
      updated: 'Última atualização: {updatedOn}',
      sections: [
        {
          heading: 'Quem somos',
          paragraphs: [
            'O zapbip é um serviço da {tradeName}, nome fantasia de {legalName}, CNPJ {cnpj}, {address}. Contato: {contactEmail}.',
          ],
          items: [],
        },
        {
          heading: 'O que o zapbip faz',
          paragraphs: [
            'O zapbip conecta os agentes de IA que você escolhe, como {agents} ou qualquer cliente MCP, ao seu próprio WhatsApp, pela plataforma oficial WhatsApp Business da Meta. Seus agentes podem mandar mensagens, fazer perguntas e receber suas respostas. O zapbip fala só com você e nunca manda mensagem para seus contatos nem para mais ninguém.',
            'O zapbip está em acesso antecipado. As contas abrem por convite a partir da lista de espera, e os recursos podem mudar no caminho.',
          ],
          items: [],
        },
        {
          heading: 'Sua conta',
          paragraphs: [],
          items: [
            'Sua conta é o seu número de WhatsApp. Você entra mandando mensagem para o zapbip; não existe senha.',
            'As mensagens chegam a você de um número do zapbip. Ainda não é possível usar o seu próprio número como remetente.',
            'Você precisa ter pelo menos 18 anos e capacidade para fazer um contrato.',
            'Guarde em segredo a chave de cada agente. Quem tiver a chave pode mandar mensagem para você como aquele agente; revogue na hora se ela vazar.',
            'Você é responsável pelo que acontece pela sua conta e pelos seus agentes.',
          ],
        },
        {
          heading: 'Seus agentes',
          paragraphs: [
            'Seus agentes são softwares que você escolhe e roda. O zapbip entrega as mensagens deles e as suas respostas, mas não escreve, não confere e não controla o que eles dizem ou fazem. O que você decide a partir da mensagem de um agente, como uma resposta por botão, é decisão sua. Os provedores de IA por trás dos seus agentes têm os próprios termos.',
          ],
          items: [],
        },
        {
          heading: 'Uso aceitável',
          paragraphs: ['Podemos suspender ou encerrar uma conta que descumpra estas regras e comunicar atividade ilegal às autoridades.'],
          items: [
            'Use o zapbip só para falar com os seus próprios agentes.',
            'Não envie spam, conteúdo ilegal ou conteúdo que viole as políticas do WhatsApp Business da Meta.',
            'Não tente falar com outras pessoas pelo zapbip, burlar os limites dele ou invadir o serviço ou outras contas.',
            'Não revenda nem sobrecarregue o zapbip.',
          ],
        },
        {
          heading: 'Planos e preços',
          paragraphs: [
            'O plano Grátis inclui {free} mensagens para testar o zapbip, sem custo. Os planos pagos e os preços do site só valem quando a cobrança abrir, e você verá e aceitará o preço antes de pagar qualquer coisa. Avisaremos com antecedência qualquer mudança de preço que afete você.',
          ],
          items: [],
        },
        {
          heading: 'Disponibilidade',
          paragraphs: [
            'Trabalhamos para manter o zapbip no ar, mas ele é oferecido como está, sem garantia de que estará sempre disponível ou de que toda mensagem será entregue. Ele depende da Meta, da Cloudflare e da internet. Não use o zapbip em emergências nem em nada em que uma mensagem atrasada ou perdida possa causar dano.',
          ],
          items: [],
        },
        {
          heading: 'Responsabilidade',
          paragraphs: [
            'Na medida permitida pela lei brasileira, a {tradeName} não responde por danos indiretos, lucros cessantes ou prejuízos causados pelos seus agentes, por serviços de terceiros ou por mensagens atrasadas ou não entregues. Nada nestes termos limita os direitos que você tem pelo Código de Defesa do Consumidor (Lei 8.078/1990) ou por outra lei que não possa ser renunciada.',
          ],
          items: [],
        },
        {
          heading: 'Encerramento da conta',
          paragraphs: [
            'Você pode apagar sua conta quando quiser, mandando "apagar conta" para o zapbip no WhatsApp. Podemos encerrar uma conta que descumpra estes termos, ou encerrar o serviço com aviso prévio. A política de privacidade explica o que acontece com seus dados.',
          ],
          items: [],
        },
        {
          heading: 'Mudanças nestes termos',
          paragraphs: [
            'Podemos atualizar estes termos; a data no topo mostra a versão atual. Avisaremos pelo WhatsApp ou neste site antes que uma mudança importante passe a valer. Continuar usando o zapbip depois disso significa aceitar os novos termos.',
          ],
          items: [],
        },
        {
          heading: 'Lei e foro',
          paragraphs: [
            'Estes termos seguem as leis do Brasil. Fica eleito o foro de Belo Horizonte, Minas Gerais, salvo quando a lei garantir a você, como consumidor, o foro do seu domicílio. Estes termos estão escritos em português e em inglês; se as versões divergirem, vale a versão em português.',
          ],
          items: [],
        },
        {
          heading: 'Contato',
          paragraphs: ['Dúvidas sobre estes termos: {contactEmail}.'],
          items: [],
        },
      ],
    },
    [OwnerLocale.Spanish]: SPANISH_LEGAL_COPY[LegalDocument.Terms],
    [OwnerLocale.German]: GERMAN_LEGAL_COPY[LegalDocument.Terms],
    [OwnerLocale.French]: FRENCH_LEGAL_COPY[LegalDocument.Terms],
    [OwnerLocale.Japanese]: JAPANESE_LEGAL_COPY[LegalDocument.Terms],
    [OwnerLocale.Korean]: KOREAN_LEGAL_COPY[LegalDocument.Terms],
    [OwnerLocale.ChineseSimplified]: CHINESE_LEGAL_COPY[LegalDocument.Terms],
    [OwnerLocale.Arabic]: ARABIC_LEGAL_COPY[LegalDocument.Terms],
  },
  [LegalDocument.Privacy]: {
    [OwnerLocale.EnglishUs]: {
      title: 'Privacy policy',
      description: 'What zapbip collects, why, for how long, and your rights under the Brazilian General Data Protection Law (LGPD).',
      summary:
        'zapbip keeps only what it needs to deliver messages between you and your agents, and deletes each piece after a fixed time. This policy follows the Brazilian General Data Protection Law (Law 13,709/2018, the LGPD).',
      updated: 'Last updated: {updatedOn}',
      sections: [
        {
          heading: 'Who is responsible',
          paragraphs: [
            '{tradeName} ({legalName}, CNPJ {cnpj}, {address}) is the controller of your personal data. Our data protection officer can be reached at {contactEmail}.',
          ],
          items: [],
        },
        {
          heading: 'What we collect',
          paragraphs: [],
          items: [
            'Waitlist: your email, the language of the page and referral data (who invited you and how many people you invited). No IP address is stored with it.',
            'Account: your WhatsApp number, your language and the date you joined.',
            'Agents: the name of each agent you connect, the app it runs in when the app tells us, when it was created and when it was last active. Each agent key is stored only as a digest.',
            'Messages: the texts, questions, buttons and replies between you and your agents, and the photos and files you exchange.',
            'Web app: a session cookie when you sign in at app.zapbip.com.',
            'Technical data: when you use the site or the service, Cloudflare, our hosting provider, processes request data such as your IP address to deliver and protect it.',
          ],
        },
        {
          heading: 'Why we use it',
          paragraphs: ['We do not sell your data, we show no ads, and we do not use your messages to train AI models.'],
          items: [
            'To provide the service you asked for: deliver messages between you and your agents and run your account (LGPD, article 7, V).',
            'To manage the waitlist and send your invitation, with the consent you give when you join (article 7, I).',
            'To keep zapbip secure and prevent abuse, such as the captcha on the waitlist form and rate limits (legitimate interest, article 7, IX).',
            'To meet legal obligations (article 7, II).',
          ],
        },
        {
          heading: 'How long we keep it',
          paragraphs: ['Logs never carry the text of your messages.'],
          items: [
            'Messages and questions waiting for you or for an agent: {messageDays} days.',
            'Photos and files: {mediaDays} days.',
            'Web app session: up to {sessionDays} days, or until you sign out.',
            'Account and agents: until you delete your account.',
            'Waitlist: until you get access or ask us to remove you.',
          ],
        },
        {
          heading: 'Who we share it with',
          paragraphs: [
            'We share data only with the providers that run zapbip. Your agents receive the messages you send them; they run under your control and under the terms of their own providers. We may also disclose data when the law or a court requires it.',
          ],
          items: [
            'Meta Platforms, through the official WhatsApp Business Platform, which carries every WhatsApp message.',
            'Cloudflare, which hosts the service and its storage and runs the captcha (Turnstile) on the waitlist form.',
            'Mintlify, which hosts the documentation at docs.zapbip.com.',
          ],
        },
        {
          heading: 'International transfer',
          paragraphs: [
            'Meta and Cloudflare process data on servers outside Brazil, including in the United States. These transfers are needed to provide the service and follow the safeguards of the LGPD (article 33).',
          ],
          items: [],
        },
        {
          heading: 'Cookies',
          paragraphs: [
            'The site sets only two cookies of its own, to remember your language and your theme, and the web app sets one session cookie when you sign in. There are no advertising or tracking cookies.',
          ],
          items: [],
        },
        {
          heading: 'Your rights',
          paragraphs: [
            'To delete your account and everything in it, send "delete account" to zapbip on WhatsApp. For anything else, write to {contactEmail}; we answer within 15 days.',
          ],
          items: [
            'Confirm whether we process your data, and access it.',
            'Correct incomplete or wrong data.',
            'Ask for unnecessary data to be anonymized, blocked or deleted.',
            'Ask for your data to be moved to another provider.',
            'Know who we share it with.',
            'Withdraw your consent at any time.',
            'Complain to the Brazilian National Data Protection Authority (ANPD).',
          ],
        },
        {
          heading: 'What Meta and Cloudflare keep',
          paragraphs: [
            'When you delete your account, Meta keeps the WhatsApp chat on its side and Cloudflare keeps backup copies, each for its own retention period. Delete the chat in WhatsApp to take it off your phone.',
          ],
          items: [],
        },
        {
          heading: 'Security',
          paragraphs: [
            'Every connection uses HTTPS. Agent keys and web app sessions are stored only as digests, and each agent has its own key that you can revoke at any time.',
          ],
          items: [],
        },
        {
          heading: 'Children',
          paragraphs: ['zapbip is not meant for anyone under 18, and we do not knowingly collect their data.'],
          items: [],
        },
        {
          heading: 'Changes to this policy',
          paragraphs: [
            'We may update this policy; the date at the top shows the current version, and we will tell you before a change that matters takes effect. This policy is written in Portuguese and in English; if the two differ, the Portuguese version prevails.',
          ],
          items: [],
        },
      ],
    },
    [OwnerLocale.PortugueseBrazil]: {
      title: 'Política de privacidade',
      description: 'O que o zapbip coleta, por quê, por quanto tempo, e os seus direitos pela Lei Geral de Proteção de Dados (LGPD).',
      summary:
        'O zapbip guarda só o que precisa para entregar mensagens entre você e seus agentes, e apaga cada dado depois de um prazo fixo. Esta política segue a Lei Geral de Proteção de Dados (Lei 13.709/2018, a LGPD).',
      updated: 'Última atualização: {updatedOn}',
      sections: [
        {
          heading: 'Quem é o responsável',
          paragraphs: [
            'A {tradeName} ({legalName}, CNPJ {cnpj}, {address}) é a controladora dos seus dados pessoais. O nosso encarregado de dados atende pelo e-mail {contactEmail}.',
          ],
          items: [],
        },
        {
          heading: 'O que coletamos',
          paragraphs: [],
          items: [
            'Lista de espera: seu e-mail, o idioma da página e os dados de indicação (quem convidou você e quantas pessoas você convidou). Nenhum endereço IP é guardado junto.',
            'Conta: seu número de WhatsApp, seu idioma e a data em que você entrou.',
            'Agentes: o nome de cada agente que você conecta, o app em que ele roda quando o app informa, quando foi criado e quando foi usado pela última vez. A chave de cada agente é guardada só como resumo criptográfico.',
            'Mensagens: os textos, perguntas, botões e respostas entre você e seus agentes, e as fotos e arquivos trocados.',
            'App web: um cookie de sessão quando você entra em app.zapbip.com.',
            'Dados técnicos: quando você usa o site ou o serviço, a Cloudflare, nossa provedora de hospedagem, trata dados da requisição, como o seu endereço IP, para entregá-lo e protegê-lo.',
          ],
        },
        {
          heading: 'Para que usamos',
          paragraphs: ['Não vendemos seus dados, não mostramos anúncios e não usamos suas mensagens para treinar modelos de IA.'],
          items: [
            'Para prestar o serviço que você pediu: entregar mensagens entre você e seus agentes e manter sua conta (LGPD, artigo 7º, V).',
            'Para gerenciar a lista de espera e enviar o seu convite, com o consentimento que você dá ao entrar (artigo 7º, I).',
            'Para manter o zapbip seguro e evitar abuso, como o captcha do formulário da lista e os limites de uso (legítimo interesse, artigo 7º, IX).',
            'Para cumprir obrigações legais (artigo 7º, II).',
          ],
        },
        {
          heading: 'Por quanto tempo guardamos',
          paragraphs: ['Os registros do sistema nunca guardam o texto das suas mensagens.'],
          items: [
            'Mensagens e perguntas esperando por você ou por um agente: {messageDays} dias.',
            'Fotos e arquivos: {mediaDays} dias.',
            'Sessão do app web: até {sessionDays} dias, ou até você sair.',
            'Conta e agentes: até você apagar sua conta.',
            'Lista de espera: até você receber o acesso ou pedir para sair.',
          ],
        },
        {
          heading: 'Com quem compartilhamos',
          paragraphs: [
            'Compartilhamos dados só com os provedores que fazem o zapbip funcionar. Seus agentes recebem as mensagens que você manda para eles; eles rodam sob o seu controle e sob os termos dos próprios provedores. Também podemos revelar dados quando a lei ou um juiz exigir.',
          ],
          items: [
            'Meta Platforms, pela plataforma oficial WhatsApp Business, que transporta todas as mensagens de WhatsApp.',
            'Cloudflare, que hospeda o serviço e o armazenamento e roda o captcha (Turnstile) do formulário da lista.',
            'Mintlify, que hospeda a documentação em docs.zapbip.com.',
          ],
        },
        {
          heading: 'Transferência internacional',
          paragraphs: [
            'A Meta e a Cloudflare tratam dados em servidores fora do Brasil, inclusive nos Estados Unidos. Essas transferências são necessárias para prestar o serviço e seguem as garantias da LGPD (artigo 33).',
          ],
          items: [],
        },
        {
          heading: 'Cookies',
          paragraphs: [
            'O site usa só dois cookies próprios, para lembrar o seu idioma e o seu tema, e o app web usa um cookie de sessão quando você entra. Não há cookies de publicidade nem de rastreamento.',
          ],
          items: [],
        },
        {
          heading: 'Seus direitos',
          paragraphs: [
            'Para apagar sua conta e tudo o que está nela, mande "apagar conta" para o zapbip no WhatsApp. Para qualquer outro pedido, escreva para {contactEmail}; respondemos em até 15 dias.',
          ],
          items: [
            'Confirmar se tratamos seus dados e acessá-los.',
            'Corrigir dados incompletos ou errados.',
            'Pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários.',
            'Pedir a portabilidade dos seus dados para outro fornecedor.',
            'Saber com quem compartilhamos seus dados.',
            'Revogar o seu consentimento a qualquer momento.',
            'Reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
          ],
        },
        {
          heading: 'O que a Meta e a Cloudflare guardam',
          paragraphs: [
            'Quando você apaga sua conta, a Meta guarda a conversa do WhatsApp do lado dela e a Cloudflare guarda cópias de segurança, cada uma pelo próprio prazo. Apague a conversa no WhatsApp para tirá-la do seu celular.',
          ],
          items: [],
        },
        {
          heading: 'Segurança',
          paragraphs: [
            'Toda conexão usa HTTPS. As chaves dos agentes e as sessões do app web são guardadas só como resumo criptográfico, e cada agente tem a própria chave, que você pode revogar quando quiser.',
          ],
          items: [],
        },
        {
          heading: 'Crianças e adolescentes',
          paragraphs: ['O zapbip não é destinado a menores de 18 anos, e não coletamos dados deles de propósito.'],
          items: [],
        },
        {
          heading: 'Mudanças nesta política',
          paragraphs: [
            'Podemos atualizar esta política; a data no topo mostra a versão atual, e avisaremos antes que uma mudança importante passe a valer. Esta política está escrita em português e em inglês; se as versões divergirem, vale a versão em português.',
          ],
          items: [],
        },
      ],
    },
    [OwnerLocale.Spanish]: SPANISH_LEGAL_COPY[LegalDocument.Privacy],
    [OwnerLocale.German]: GERMAN_LEGAL_COPY[LegalDocument.Privacy],
    [OwnerLocale.French]: FRENCH_LEGAL_COPY[LegalDocument.Privacy],
    [OwnerLocale.Japanese]: JAPANESE_LEGAL_COPY[LegalDocument.Privacy],
    [OwnerLocale.Korean]: KOREAN_LEGAL_COPY[LegalDocument.Privacy],
    [OwnerLocale.ChineseSimplified]: CHINESE_LEGAL_COPY[LegalDocument.Privacy],
    [OwnerLocale.Arabic]: ARABIC_LEGAL_COPY[LegalDocument.Privacy],
  },
};

const ARABIC_PLURAL_RULES = new Intl.PluralRules(ARABIC_PLURAL_LOCALE);
const ARABIC_DAY_NOUN_BY_CATEGORY: Record<Intl.LDMLPluralRule, string> = {
  zero: 'يوم',
  one: 'يوم',
  two: 'يومين',
  few: 'أيام',
  many: 'يومًا',
  other: 'يوم',
};

export function daysOf(input: { milliseconds: number; locale: OwnerLocale }): string {
  const days = input.milliseconds / DAY_MS;
  const count = formatCount({ count: days, locale: input.locale });
  if (input.locale !== OwnerLocale.Arabic) return count;
  return `${count} ${ARABIC_DAY_NOUN_BY_CATEGORY[ARABIC_PLURAL_RULES.select(days)]}`;
}

function legalValuesOf(input: { locale: OwnerLocale }): Record<string, string> {
  const { locale } = input;
  return {
    agents: leadingAgentNames({ locale }),
    tradeName: COMPANY.tradeName,
    legalName: COMPANY.legalName,
    cnpj: COMPANY.cnpj,
    address: COMPANY.address,
    free: formatCount({ count: PRICING_FREE_MESSAGES, locale }),
    messageDays: daysOf({ milliseconds: QUEUE_RETENTION_MS, locale }),
    mediaDays: daysOf({ milliseconds: MEDIA_RETENTION_MS, locale }),
    sessionDays: daysOf({ milliseconds: CLIENT_APP_SESSION_TTL_MS, locale }),
    updatedOn: new Intl.DateTimeFormat(formattingLocaleOf({ locale }), { dateStyle: 'long', timeZone: UTC_TIME_ZONE }).format(
      new Date(LEGAL_UPDATED_ON),
    ),
  };
}

function filled(input: { text: string; values: Record<string, string> }): string {
  return Object.entries(input.values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), input.text);
}

export function legalTextOf(input: { document: LegalDocument; locale: OwnerLocale }): LegalText {
  const values = legalValuesOf({ locale: input.locale });
  const fill = (text: string): string => filled({ text, values });
  const text = LEGAL_COPY[input.document][input.locale];
  return {
    title: fill(text.title),
    description: fill(text.description),
    summary: fill(text.summary),
    updated: fill(text.updated),
    sections: text.sections.map((section) => ({
      heading: fill(section.heading),
      paragraphs: section.paragraphs.map(fill),
      items: section.items.map(fill),
    })),
  };
}

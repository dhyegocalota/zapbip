import { OwnerLocale } from '@zapbip/types';
import { ClientAppCopyKey } from './client-app-copy-keys';
import { SPANISH_CLIENT_APP_COPY } from './client-app-copy-spanish';
import { GERMAN_CLIENT_APP_COPY } from './client-app-copy-german';
import { FRENCH_CLIENT_APP_COPY } from './client-app-copy-french';
import { JAPANESE_CLIENT_APP_COPY } from './client-app-copy-japanese';
import { KOREAN_CLIENT_APP_COPY } from './client-app-copy-korean';
import { ARABIC_CLIENT_APP_COPY } from './client-app-copy-arabic';
import { CHINESE_CLIENT_APP_COPY } from './client-app-copy-chinese';

export { ClientAppCopyKey };

type CopyEntries = Record<ClientAppCopyKey, string>;

const ENGLISH_COPY: CopyEntries = {
  [ClientAppCopyKey.SkipToContent]: 'Skip to content',
  [ClientAppCopyKey.BrandName]: 'zapbip',
  [ClientAppCopyKey.BrandHomeLabel]: 'zapbip home',
  [ClientAppCopyKey.SignOut]: 'Sign out',
  [ClientAppCopyKey.SignedOutTitle]: 'Sign in with one WhatsApp message',
  [ClientAppCopyKey.SignedOutLead]: 'Sign in with the WhatsApp you already use with zapbip. No password, no code to type.',
  [ClientAppCopyKey.SignInWithWhatsapp]: 'Sign in with WhatsApp',
  [ClientAppCopyKey.SignedOutNote]: 'WhatsApp opens with a message ready to send. We answer with a link that works once for 10 minutes.',
  [ClientAppCopyKey.SignedOutEyebrow]: 'Sign in',
  [ClientAppCopyKey.SignedOutAgents]: 'Agents: use the MCP tools',
  [ClientAppCopyKey.SignedOutAgentsLink]: 'Read the docs',
  [ClientAppCopyKey.SignedOutTrustLabel]: 'Why it is safe',
  [ClientAppCopyKey.SignedOutTrustApi]: 'Official WhatsApp API',
  [ClientAppCopyKey.SignedOutTrustPassword]: 'No password to remember',
  [ClientAppCopyKey.SignedOutTrustLink]: 'One-time link, 10 minutes',
  [ClientAppCopyKey.PhoneLabel]: 'The sign-in conversation in WhatsApp: you send login and zapbip answers with a one-time link.',
  [ClientAppCopyKey.PhoneReply]: 'Here is your sign-in link. It works once and expires in 10 minutes.',
  [ClientAppCopyKey.UnavailableTitle]: 'Sign in is not available right now',
  [ClientAppCopyKey.UnavailableBody]: 'Try again in a few minutes.',
  [ClientAppCopyKey.ContinueTitle]: 'Sign in to zapbip',
  [ClientAppCopyKey.ContinueLead]: 'Continue to open your agents on this device.',
  [ClientAppCopyKey.ContinueAs]: 'Signing in as {phone}.',
  [ClientAppCopyKey.ContinueButton]: 'Continue',
  [ClientAppCopyKey.ExpiredTitle]: 'This link expired',
  [ClientAppCopyKey.ExpiredBody]: 'This link expired. Send login again.',
  [ClientAppCopyKey.ForbiddenTitle]: 'This request was refused',
  [ClientAppCopyKey.ForbiddenBody]: 'Go back, reload the page and try again.',
  [ClientAppCopyKey.RateLimitedTitle]: 'Too many attempts',
  [ClientAppCopyKey.RateLimitedBody]: 'Wait a minute and try again.',
  [ClientAppCopyKey.NotFoundTitle]: 'Page not found',
  [ClientAppCopyKey.NotFoundBody]: 'There is nothing at this address.',
  [ClientAppCopyKey.BackHome]: 'Back to the start',
  [ClientAppCopyKey.WaitlistTitle]: "You're on the waitlist",
  [ClientAppCopyKey.WaitlistBody]: 'We will message you on WhatsApp when your access opens.',
  [ClientAppCopyKey.AgentsTitle]: 'Your agents',
  [ClientAppCopyKey.AgentsEmpty]: 'No agents yet. Connect your first one below.',
  [ClientAppCopyKey.AgentCreated]: 'Agent {agent} created. Paste this into your agent:',
  [ClientAppCopyKey.AgentCreatedHint]: 'This is shown once. If the link expires or was used, revoke the agent and connect it again.',
  [ClientAppCopyKey.AgentClient]: 'Client',
  [ClientAppCopyKey.AgentAdded]: 'Added {date}',
  [ClientAppCopyKey.AgentLastActive]: 'Last active {date}',
  [ClientAppCopyKey.SignedInAs]: 'Signed in as {phone}',
  [ClientAppCopyKey.Revoke]: 'Revoke',
  [ClientAppCopyKey.ConnectTitle]: 'Connect an agent',
  [ClientAppCopyKey.ConnectLabel]: 'Agent name',
  [ClientAppCopyKey.ConnectButton]: 'Connect',
  [ClientAppCopyKey.ConnectHint]: 'Up to 20 lowercase letters, numbers or hyphens.',
  [ClientAppCopyKey.ProblemEmptyName]: 'Enter a name for the agent.',
  [ClientAppCopyKey.ProblemInvalidName]:
    'Invalid name. Use 1 to 20 lowercase letters, numbers or hyphens, starting with a letter or number.',
  [ClientAppCopyKey.ProblemReservedName]: 'That name is reserved because it starts a command. Choose another one.',
  [ClientAppCopyKey.ProblemNameTaken]: 'An agent with that name already exists.',
  [ClientAppCopyKey.ProblemLimitReached]: 'You reached the limit of {limit} agents. Revoke one to free a slot.',
  [ClientAppCopyKey.RevokeTitle]: 'Revoke {agent}?',
  [ClientAppCopyKey.RevokeBody]: 'It stops working at once and this cannot be undone.',
  [ClientAppCopyKey.RevokeConfirm]: 'Revoke agent',
  [ClientAppCopyKey.RevokeCancel]: 'Cancel',
  [ClientAppCopyKey.NoticeRevoked]: 'Agent revoked.',
  [ClientAppCopyKey.NoticeAgentMissing]: 'That agent is no longer connected.',
  [ClientAppCopyKey.PlanLine]: 'Free · {free} messages to try it',
  [ClientAppCopyKey.AccountTitle]: 'Account',
  [ClientAppCopyKey.DeleteAccount]: 'Delete account',
  [ClientAppCopyKey.DeleteAccountHint]: 'Deleting your account is done on WhatsApp. The guide explains how.',
  [ClientAppCopyKey.FooterMaker]: 'zapbip, a personal WhatsApp channel for your AI agents',
};

const PORTUGUESE_COPY: CopyEntries = {
  [ClientAppCopyKey.SkipToContent]: 'Ir para o conteúdo',
  [ClientAppCopyKey.BrandName]: 'zapbip',
  [ClientAppCopyKey.BrandHomeLabel]: 'Início do zapbip',
  [ClientAppCopyKey.SignOut]: 'Sair',
  [ClientAppCopyKey.SignedOutTitle]: 'Entre com uma mensagem no WhatsApp',
  [ClientAppCopyKey.SignedOutLead]: 'Entre com o WhatsApp que você já usa no zapbip. Sem senha, sem código para digitar.',
  [ClientAppCopyKey.SignInWithWhatsapp]: 'Entrar com WhatsApp',
  [ClientAppCopyKey.SignedOutNote]:
    'O WhatsApp abre com uma mensagem pronta para enviar. Respondemos com um link que vale uma vez por 10 minutos.',
  [ClientAppCopyKey.SignedOutEyebrow]: 'Entrar',
  [ClientAppCopyKey.SignedOutAgents]: 'Agentes: use as ferramentas MCP',
  [ClientAppCopyKey.SignedOutAgentsLink]: 'Leia a documentação',
  [ClientAppCopyKey.SignedOutTrustLabel]: 'Por que é seguro',
  [ClientAppCopyKey.SignedOutTrustApi]: 'API oficial do WhatsApp',
  [ClientAppCopyKey.SignedOutTrustPassword]: 'Sem senha para lembrar',
  [ClientAppCopyKey.SignedOutTrustLink]: 'Link de uso único, 10 minutos',
  [ClientAppCopyKey.PhoneLabel]: 'A conversa de login no WhatsApp: você envia entrar e o zapbip responde com um link de uso único.',
  [ClientAppCopyKey.PhoneReply]: 'Aqui está o seu link de acesso. Ele funciona uma vez e expira em 10 minutos.',
  [ClientAppCopyKey.UnavailableTitle]: 'A entrada não está disponível agora',
  [ClientAppCopyKey.UnavailableBody]: 'Tente de novo em alguns minutos.',
  [ClientAppCopyKey.ContinueTitle]: 'Entrar no zapbip',
  [ClientAppCopyKey.ContinueLead]: 'Continue para abrir seus agentes neste aparelho.',
  [ClientAppCopyKey.ContinueAs]: 'Entrando como {phone}.',
  [ClientAppCopyKey.ContinueButton]: 'Continuar',
  [ClientAppCopyKey.ExpiredTitle]: 'Este link expirou',
  [ClientAppCopyKey.ExpiredBody]: 'Este link expirou. Envie entrar de novo.',
  [ClientAppCopyKey.ForbiddenTitle]: 'Esta solicitação foi recusada',
  [ClientAppCopyKey.ForbiddenBody]: 'Volte, recarregue a página e tente de novo.',
  [ClientAppCopyKey.RateLimitedTitle]: 'Tentativas demais',
  [ClientAppCopyKey.RateLimitedBody]: 'Espere um minuto e tente de novo.',
  [ClientAppCopyKey.NotFoundTitle]: 'Página não encontrada',
  [ClientAppCopyKey.NotFoundBody]: 'Não há nada neste endereço.',
  [ClientAppCopyKey.BackHome]: 'Voltar ao início',
  [ClientAppCopyKey.WaitlistTitle]: 'Você está na lista de espera',
  [ClientAppCopyKey.WaitlistBody]: 'Avisamos você no WhatsApp quando o seu acesso abrir.',
  [ClientAppCopyKey.AgentsTitle]: 'Seus agentes',
  [ClientAppCopyKey.AgentsEmpty]: 'Nenhum agente ainda. Conecte o primeiro abaixo.',
  [ClientAppCopyKey.AgentCreated]: 'Agente {agent} criado. Cole no seu agente:',
  [ClientAppCopyKey.AgentCreatedHint]: 'Isto aparece uma vez. Se o link expirar ou for usado, revogue o agente e conecte de novo.',
  [ClientAppCopyKey.AgentClient]: 'Cliente',
  [ClientAppCopyKey.AgentAdded]: 'Criado em {date}',
  [ClientAppCopyKey.AgentLastActive]: 'Ativo em {date}',
  [ClientAppCopyKey.SignedInAs]: 'Conectado como {phone}',
  [ClientAppCopyKey.Revoke]: 'Revogar',
  [ClientAppCopyKey.ConnectTitle]: 'Conectar um agente',
  [ClientAppCopyKey.ConnectLabel]: 'Nome do agente',
  [ClientAppCopyKey.ConnectButton]: 'Conectar',
  [ClientAppCopyKey.ConnectHint]: 'Até 20 letras minúsculas, números ou hífens.',
  [ClientAppCopyKey.ProblemEmptyName]: 'Informe um nome para o agente.',
  [ClientAppCopyKey.ProblemInvalidName]:
    'Nome inválido. Use de 1 a 20 letras minúsculas, números ou hífens, começando por letra ou número.',
  [ClientAppCopyKey.ProblemReservedName]: 'Esse nome é reservado porque é o início de um comando. Escolha outro.',
  [ClientAppCopyKey.ProblemNameTaken]: 'Já existe um agente com esse nome.',
  [ClientAppCopyKey.ProblemLimitReached]: 'Você atingiu o limite de {limit} agentes. Revogue um para liberar uma vaga.',
  [ClientAppCopyKey.RevokeTitle]: 'Revogar {agent}?',
  [ClientAppCopyKey.RevokeBody]: 'Ele deixa de funcionar na hora e isso não tem volta.',
  [ClientAppCopyKey.RevokeConfirm]: 'Revogar agente',
  [ClientAppCopyKey.RevokeCancel]: 'Cancelar',
  [ClientAppCopyKey.NoticeRevoked]: 'Agente revogado.',
  [ClientAppCopyKey.NoticeAgentMissing]: 'Esse agente não está mais conectado.',
  [ClientAppCopyKey.PlanLine]: 'Grátis · {free} mensagens para testar',
  [ClientAppCopyKey.AccountTitle]: 'Conta',
  [ClientAppCopyKey.DeleteAccount]: 'Apagar conta',
  [ClientAppCopyKey.DeleteAccountHint]: 'Apagar a conta é feito no WhatsApp. O guia explica como.',
  [ClientAppCopyKey.FooterMaker]: 'zapbip, um canal pessoal de WhatsApp para os seus agentes de IA',
};

const CLIENT_APP_COPY: Record<OwnerLocale, CopyEntries> = {
  [OwnerLocale.EnglishUs]: ENGLISH_COPY,
  [OwnerLocale.PortugueseBrazil]: PORTUGUESE_COPY,
  [OwnerLocale.Spanish]: SPANISH_CLIENT_APP_COPY,
  [OwnerLocale.German]: GERMAN_CLIENT_APP_COPY,
  [OwnerLocale.French]: FRENCH_CLIENT_APP_COPY,
  [OwnerLocale.Japanese]: JAPANESE_CLIENT_APP_COPY,
  [OwnerLocale.Korean]: KOREAN_CLIENT_APP_COPY,
  [OwnerLocale.ChineseSimplified]: CHINESE_CLIENT_APP_COPY,
  [OwnerLocale.Arabic]: ARABIC_CLIENT_APP_COPY,
};

export function renderClientAppCopy(input: { key: ClientAppCopyKey; locale: OwnerLocale; values?: Record<string, string> }): string {
  const { key, locale, values = {} } = input;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), CLIENT_APP_COPY[locale][key]);
}

export function copyOf(input: { locale: OwnerLocale }): (key: ClientAppCopyKey, values?: Record<string, string>) => string {
  return (key, values) => renderClientAppCopy({ key, locale: input.locale, values });
}

import { InstallClient, OwnerLocale } from '@zapbip/types';

export const WAKE_NOTES: Record<InstallClient, Record<OwnerLocale, string>> = {
  [InstallClient.ClaudeCode]: {
    [OwnerLocale.PortugueseBrazil]:
      'O Claude Code escuta sem limite de tempo: o canal entrega na hora com a sessão aberta, e o conector retoma uma sessão parada em cerca de 7 segundos.',
    [OwnerLocale.EnglishUs]:
      'Claude Code listens with no time limit: the channel delivers at once while the session is open, and the connector resumes a stopped session in about 7 seconds.',
  },
  [InstallClient.Codex]: {
    [OwnerLocale.PortugueseBrazil]: 'O conector retoma a sessão do Codex a cada mensagem, em cerca de 6 segundos, sem limite de tempo.',
    [OwnerLocale.EnglishUs]: 'The connector resumes the Codex session on each message, in about 6 seconds, with no time limit.',
  },
  [InstallClient.Cursor]: {
    [OwnerLocale.PortugueseBrazil]:
      'O Cursor escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo.',
    [OwnerLocale.EnglishUs]: 'Cursor listens through the background terminal and answers within seconds while it runs, with no time limit.',
  },
  [InstallClient.GeminiCli]: {
    [OwnerLocale.PortugueseBrazil]:
      'O Gemini CLI escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo.',
    [OwnerLocale.EnglishUs]:
      'Gemini CLI listens through the background terminal and answers within seconds while it runs, with no time limit.',
  },
  [InstallClient.Hermes]: {
    [OwnerLocale.PortugueseBrazil]:
      'O plugin entrega cada mensagem na hora; sem o plugin, o Hermes verifica a caixa de entrada a cada minuto.',
    [OwnerLocale.EnglishUs]: 'The plugin delivers each message at once; without the plugin, Hermes checks the inbox every minute.',
  },
  [InstallClient.OpenClaw]: {
    [OwnerLocale.PortugueseBrazil]:
      'O plugin entrega cada mensagem na hora; sem o plugin, o OpenClaw verifica a caixa de entrada a cada minuto.',
    [OwnerLocale.EnglishUs]: 'The plugin delivers each message at once; without the plugin, OpenClaw checks the inbox every minute.',
  },
  [InstallClient.GrokBot]: {
    [OwnerLocale.PortugueseBrazil]: 'O webhook da rotina acorda o Grok Bot em cerca de 9 segundos, sem limite de tempo.',
    [OwnerLocale.EnglishUs]: 'The routine webhook wakes Grok Bot in about 9 seconds, with no time limit.',
  },
  [InstallClient.ClaudeAi]: {
    [OwnerLocale.PortugueseBrazil]:
      'O webhook da rotina acorda o claude.ai em cerca de 16 segundos; a tarefa agendada de segurança roda no máximo uma vez a cada 60 minutos, limite da plataforma.',
    [OwnerLocale.EnglishUs]:
      'The routine webhook wakes claude.ai in about 16 seconds; the safety-net scheduled task runs at most once every 60 minutes, a platform minimum.',
  },
  [InstallClient.ChatGpt]: {
    [OwnerLocale.PortugueseBrazil]: 'O ChatGPT é acordado por uma tarefa agendada a cada hora: uma mensagem pode esperar até uma hora.',
    [OwnerLocale.EnglishUs]: 'ChatGPT is woken by a scheduled task every hour: a message can wait up to an hour.',
  },
  [InstallClient.GrokWeb]: {
    [OwnerLocale.PortugueseBrazil]: 'O Grok na web não acorda sozinho: o agente de prontidão escolhido responde por ele em segundos.',
    [OwnerLocale.EnglishUs]: 'Grok on the web cannot be woken from outside: the chosen standby agent answers for it within seconds.',
  },
};

const GROK_WEB_WITHOUT_STANDBY_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Sem um agente de prontidão, o Grok na web só vê mensagens novas quando você abre o chat dele.',
  [OwnerLocale.EnglishUs]: 'Without a standby agent, Grok on the web sees new messages only when you open the chat.',
};

export function wakeNoteOf(input: { client: InstallClient; locale: OwnerLocale; standbyAgent: string | null }): string {
  if (input.client === InstallClient.GrokWeb && input.standbyAgent === null) return GROK_WEB_WITHOUT_STANDBY_NOTE[input.locale];
  return WAKE_NOTES[input.client][input.locale];
}

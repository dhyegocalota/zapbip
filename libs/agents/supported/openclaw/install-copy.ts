import { HEARTBEAT_POLL_INTERVAL_MINUTES, OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, noticeStep, tellOwnerAndWait, type InstallProduct } from '@zapbip/core';
import { installCommand } from './plugin';
import { quickStartOf } from '../../src/quick-start';

export const OPENCLAW_PRODUCT: InstallProduct = { productName: 'OpenClaw', productDescription: 'OpenClaw, the agent running OpenClaw' };

type OpenClawText = {
  wakeNote: string;
  pluginPermission: string;
  pollCost: string;
};

const OPENCLAW_TEXT: Record<OwnerLocale, OpenClawText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O plugin entrega cada mensagem na hora; sem o plugin, o OpenClaw verifica a caixa de entrada a cada minuto.',
    pluginPermission:
      'O plugin do zapbip lê as suas mensagens para este agente no zapbip e publica as respostas do agente de volta. Ele não faz mais nada. Posso instalar?',
    pollCost: 'Verificar a cada minuto gasta chamadas do modelo.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'The plugin delivers each message at once; without the plugin, OpenClaw checks the inbox every minute.',
    pluginPermission:
      'The zapbip plugin reads your messages for this agent from zapbip and posts the agent replies back. It does nothing else. May I install it?',
    pollCost: 'Checking every minute costs model calls.',
  },
  [OwnerLocale.Spanish]: {
    wakeNote: 'El plugin entrega cada mensaje al instante; sin el plugin, OpenClaw revisa la bandeja de entrada cada minuto.',
    pluginPermission:
      'El plugin de zapbip lee desde zapbip tus mensajes para este agente y publica de vuelta las respuestas del agente. No hace nada más. ¿Puedo instalarlo?',
    pollCost: 'Revisar cada minuto consume llamadas al modelo.',
  },
  [OwnerLocale.German]: {
    wakeNote: 'Das Plugin liefert jede Nachricht sofort; ohne das Plugin prüft OpenClaw den Posteingang jede Minute.',
    pluginPermission:
      'Das zapbip-Plugin liest deine Nachrichten für diesen Agenten aus zapbip und sendet die Antworten des Agenten zurück. Mehr tut es nicht. Darf ich es installieren?',
    pollCost: 'Die Prüfung jede Minute verursacht Modellaufrufe.',
  },
  [OwnerLocale.French]: {
    wakeNote: 'Le plugin livre chaque message aussitôt\u202f; sans le plugin, OpenClaw consulte la boîte de réception chaque minute.',
    pluginPermission:
      'Le plugin zapbip lit depuis zapbip vos messages destinés à cet agent et renvoie les réponses de l’agent. Il ne fait rien d’autre. Puis-je l’installer\u202f?',
    pollCost: 'Consulter chaque minute coûte des appels au modèle.',
  },
  [OwnerLocale.Japanese]: {
    wakeNote: 'プラグインはメッセージを即座に配信します。プラグインがない場合、OpenClawは1分ごとに受信箱を確認します。',
    pluginPermission:
      'zapbipプラグインは、このエージェント宛のメッセージをzapbipから読み取り、エージェントの返信をzapbipに送り返します。それ以外のことはしません。インストールしてよろしいですか？',
    pollCost: '1分ごとの確認は、モデルの呼び出しを消費します。',
  },
  [OwnerLocale.Korean]: {
    wakeNote: '플러그인은 각 메시지를 즉시 전달합니다. 플러그인이 없으면 OpenClaw가 1분마다 받은 편지함을 확인합니다.',
    pluginPermission:
      'zapbip 플러그인은 이 에이전트에게 온 메시지를 zapbip에서 읽고 에이전트의 답장을 다시 보냅니다. 그 밖의 일은 하지 않습니다. 설치해도 될까요?',
    pollCost: '1분마다 확인하면 모델 호출이 소모됩니다.',
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: '插件会立即送达每条消息；没有插件时，OpenClaw 每分钟检查一次收件箱。',
    pluginPermission: 'zapbip 插件会从 zapbip 读取发给这个智能体的消息，并把智能体的回复发回去，别的什么都不做。可以安装吗？',
    pollCost: '每分钟检查一次会消耗模型调用。',
  },
  [OwnerLocale.Arabic]: {
    wakeNote: 'يسلّم المكوّن الإضافي كل رسالة فورًا؛ ومن دونه يفحص OpenClaw صندوق الوارد كل دقيقة.',
    pluginPermission:
      'يقرأ المكوّن الإضافي zapbip رسائلك الموجّهة إلى هذا الوكيل من zapbip وينشر ردود الوكيل عائدةً إليها، ولا يفعل شيئًا غير ذلك. هل أستطيع تثبيته؟',
    pollCost: 'الفحص كل دقيقة يستهلك استدعاءات للنموذج.',
  },
};

export const OPENCLAW_COPY = localizeCopy({
  texts: OPENCLAW_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...OPENCLAW_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `Add this entry to the OpenClaw configuration, merging it into any existing \`mcp.servers\`:\n\n\`\`\`json\n${openclawServerEntry({ connectionLink: section.connectionLink })}\n\`\`\`\n\nIf the URL form is refused, use the same host with \`/mcp\` and the header \`Authorization: Bearer <the secret after /c/ in that URL>\`.`,
          success: '`mcp.servers` holds the zapbip entry.',
        },
        {
          action: `Preferred: ${tellOwnerAndWait(text.pluginPermission)} If the owner says no, skip to the next step. If yes, run \`${installCommand}\` and set \`channels.zapbip.connectionLink\` to ${section.connectionLink}. The plugin is the listener, with no time limit. If it works, call \`set_wake({mode: "local"})\` and go to the last step.`,
          success: 'the install command exits with zero and set_wake returns without an error, or the owner said no.',
        },
        {
          action: `Only if the plugin cannot be installed, and never together with it: with the automations tool create a job that runs every minute (\`every 1m\`) and calls \`check_inbox\`, then call \`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})\`.`,
          success: 'the automations tool lists the job and set_wake returns without an error.',
        },
        noticeStep(text.pollCost),
        chatSelfTest(section.locale),
      ],
    }),
});

export function openclawServerEntry(input: { connectionLink: string }): string {
  return `{ "mcp": { "servers": {\n  "zapbip": { "url": "${input.connectionLink}", "transport": "streamable-http" }\n} } }`;
}

const OPENCLAW_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Na configuração do OpenClaw, em mcp.servers.zapbip',
  [OwnerLocale.EnglishUs]: 'In the OpenClaw config, under mcp.servers.zapbip',
  [OwnerLocale.Spanish]: 'En la configuración de OpenClaw, bajo mcp.servers.zapbip',
  [OwnerLocale.German]: 'In der OpenClaw-Konfiguration, unter mcp.servers.zapbip',
  [OwnerLocale.French]: 'Dans la configuration d’OpenClaw, sous mcp.servers.zapbip',
  [OwnerLocale.Japanese]: 'OpenClawの設定の、mcp.servers.zapbipの下に',
  [OwnerLocale.Korean]: 'OpenClaw 설정에서 mcp.servers.zapbip 아래에',
  [OwnerLocale.ChineseSimplified]: '在 OpenClaw 配置中，放在 mcp.servers.zapbip 下',
  [OwnerLocale.Arabic]: 'في إعدادات OpenClaw، تحت mcp.servers.zapbip',
};

export const OPENCLAW_QUICK_START = quickStartOf({
  hint: OPENCLAW_QUICK_START_HINT,
  code: (connectionLink) => openclawServerEntry({ connectionLink }),
});

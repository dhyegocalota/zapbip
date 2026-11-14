import { HEARTBEAT_POLL_INTERVAL_MINUTES, OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, noticeStep, type InstallProduct } from '@zapbip/core';
import { installCommand } from './plugin';
import { quickStartOf } from '../../src/quick-start';

export const HERMES_PRODUCT: InstallProduct = { productName: 'Hermes', productDescription: 'Hermes, the agent running Hermes' };

type HermesText = {
  wakeNote: string;
  pollCost: string;
};

const HERMES_TEXT: Record<OwnerLocale, HermesText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O plugin entrega cada mensagem na hora; sem o plugin, o Hermes verifica a caixa de entrada a cada minuto.',
    pollCost: 'Verificar a cada minuto gasta chamadas do modelo.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'The plugin delivers each message at once; without the plugin, Hermes checks the inbox every minute.',
    pollCost: 'Checking every minute costs model calls.',
  },
  [OwnerLocale.Spanish]: {
    wakeNote: 'El plugin entrega cada mensaje al instante; sin el plugin, Hermes revisa la bandeja de entrada cada minuto.',
    pollCost: 'Revisar cada minuto consume llamadas al modelo.',
  },
  [OwnerLocale.German]: {
    wakeNote: 'Das Plugin liefert jede Nachricht sofort; ohne das Plugin prüft Hermes den Posteingang jede Minute.',
    pollCost: 'Die Prüfung jede Minute verursacht Modellaufrufe.',
  },
  [OwnerLocale.French]: {
    wakeNote: 'Le plugin livre chaque message aussitôt\u202f; sans le plugin, Hermes consulte la boîte de réception chaque minute.',
    pollCost: 'Consulter chaque minute coûte des appels au modèle.',
  },
  [OwnerLocale.Japanese]: {
    wakeNote: 'プラグインはメッセージを即座に配信します。プラグインがない場合、Hermesは1分ごとに受信箱を確認します。',
    pollCost: '1分ごとの確認は、モデルの呼び出しを消費します。',
  },
  [OwnerLocale.Korean]: {
    wakeNote: '플러그인은 각 메시지를 즉시 전달해요. 플러그인이 없으면 Hermes가 1분마다 받은 편지함을 확인해요.',
    pollCost: '1분마다 확인하면 모델 호출이 소모돼요.',
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: '插件会立即送达每条消息；没有插件时，Hermes 每分钟检查一次收件箱。',
    pollCost: '每分钟检查一次会消耗模型调用。',
  },
  [OwnerLocale.Arabic]: {
    wakeNote: 'يسلّم المكوّن الإضافي كل رسالة فورًا؛ ومن دونه يفحص Hermes صندوق الوارد كل دقيقة.',
    pollCost: 'الفحص كل دقيقة يستهلك استدعاءات للنموذج.',
  },
  [OwnerLocale.Hindi]: {
    wakeNote: 'प्लगइन हर संदेश तुरंत पहुँचाता है; प्लगइन के बिना Hermes हर मिनट इनबॉक्स देखता है।',
    pollCost: 'हर मिनट इनबॉक्स देखने पर मॉडल कॉल का खर्च आता है।',
  },
};

export const HERMES_COPY = localizeCopy({
  texts: HERMES_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...HERMES_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `Add the MCP server named zapbip to \`config.yaml\`, merging this entry into any existing \`mcp_servers\`:\n\n\`\`\`yaml\n${hermesServerEntry({ connectionLink: section.connectionLink })}\n\`\`\``,
          success: '`config.yaml` holds the zapbip entry under `mcp_servers`.',
        },
        {
          action: `Preferred: run \`${installCommand}\` so it is importable by Hermes (Hermes then enables the platform by itself), and set \`ZAPBIP_CONNECTION_LINK=${section.connectionLink}\` and \`ZAPBIP_ALLOWED_USERS=owner\` in the Hermes environment, because the Hermes allowlist otherwise refuses the owner. The plugin is the listener, with no time limit. If it works, call \`set_wake({mode: "local"})\` and go to the last step.`,
          success: 'the install command exits with zero and set_wake returns without an error.',
        },
        {
          action: `Only if the plugin cannot be installed, and never together with it: create a \`cronjob_manage\` job that runs every minute and calls \`check_inbox\`, then call \`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})\`.`,
          success: 'the job is listed by `cronjob_manage` and set_wake returns without an error.',
        },
        noticeStep(text.pollCost),
        chatSelfTest(section.locale),
      ],
    }),
});

export function hermesServerEntry(input: { connectionLink: string }): string {
  return `mcp_servers:\n  zapbip:\n    url: ${input.connectionLink}`;
}

const HERMES_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'No config.yaml do Hermes, em mcp_servers',
  [OwnerLocale.EnglishUs]: 'In the Hermes config.yaml, under mcp_servers',
  [OwnerLocale.Spanish]: 'En el config.yaml de Hermes, bajo mcp_servers',
  [OwnerLocale.German]: 'In der config.yaml von Hermes, unter mcp_servers',
  [OwnerLocale.French]: 'Dans le config.yaml de Hermes, sous mcp_servers',
  [OwnerLocale.Japanese]: 'Hermesのconfig.yamlの、mcp_serversの下に',
  [OwnerLocale.Korean]: 'Hermes의 config.yaml에서 mcp_servers 아래에',
  [OwnerLocale.ChineseSimplified]: '在 Hermes 的 config.yaml 中，放在 mcp_servers 下',
  [OwnerLocale.Arabic]: 'في ملف config.yaml الخاص بـ Hermes، تحت mcp_servers',
  [OwnerLocale.Hindi]: 'Hermes के config.yaml में, mcp_servers के नीचे',
};

export const HERMES_QUICK_START = quickStartOf({
  hint: HERMES_QUICK_START_HINT,
  code: (connectionLink) => hermesServerEntry({ connectionLink }),
});

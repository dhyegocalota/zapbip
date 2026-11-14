import { OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, tellOwner, type InstallProduct } from '@zapbip/core';
import { addressText, quickStartOf } from '../../src/quick-start';

export const GROK_BOT_PRODUCT: InstallProduct = { productName: 'Grok Bot', productDescription: 'Grok Bot, the Grok routines bot' };

type GrokBotText = {
  wakeNote: string;
  confirmServer: string;
};

const GROK_BOT_TEXT: Record<OwnerLocale, GrokBotText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O webhook da rotina acorda o Grok Bot em cerca de 9 segundos, sem limite de tempo.',
    confirmServer: 'Estou adicionando o servidor MCP zapbip ao Grok Bot. Confirme a adição quando ele pedir.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'The routine webhook wakes Grok Bot in about 9 seconds, with no time limit.',
    confirmServer: 'I am adding the zapbip MCP server to Grok Bot. Confirm it when it asks.',
  },
  [OwnerLocale.Spanish]: {
    wakeNote: 'El webhook de la rutina despierta a Grok Bot en unos 9 segundos, sin límite de tiempo.',
    confirmServer: 'Estoy añadiendo el servidor MCP de zapbip a Grok Bot. Confírmalo cuando te lo pida.',
  },
  [OwnerLocale.German]: {
    wakeNote: 'Der Routine-Webhook weckt Grok Bot in etwa 9 Sekunden, ohne Zeitlimit.',
    confirmServer: 'Ich füge den zapbip-MCP-Server zu Grok Bot hinzu. Bestätige es, wenn er danach fragt.',
  },
  [OwnerLocale.French]: {
    wakeNote: 'Le webhook de la routine réveille Grok Bot en environ 9 secondes, sans limite de temps.',
    confirmServer: 'J’ajoute le serveur MCP zapbip à Grok Bot. Confirmez-le quand il vous le demande.',
  },
  [OwnerLocale.Japanese]: {
    wakeNote: 'ルーティンのWebhookは約9秒でGrok Botを起動します。時間制限はありません。',
    confirmServer: 'zapbipのMCPサーバーをGrok Botに追加しています。確認を求められたら承認してください。',
  },
  [OwnerLocale.Korean]: {
    wakeNote: '루틴 웹훅은 약 9초 만에 Grok Bot을 깨웁니다. 시간 제한은 없습니다.',
    confirmServer: 'zapbip MCP 서버를 Grok Bot에 추가하는 중입니다. 확인을 요청하면 승인해 주세요.',
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: '例行任务的 Webhook 大约 9 秒就能唤醒 Grok Bot，不限时。',
    confirmServer: '我正在把 zapbip MCP 服务器添加到 Grok Bot。它请求确认时，请确认。',
  },
};

export const GROK_BOT_COPY = localizeCopy({
  texts: GROK_BOT_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...GROK_BOT_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `Add the MCP server named zapbip at ${section.connectionLink}. ${tellOwner(text.confirmServer)} Wait for the owner to confirm.`,
          success: 'the owner confirmed the server in the chat.',
        },
        { action: 'Create a routine with a webhook trigger.', success: 'the routine exists and shows its webhook URL and key.' },
        {
          action:
            'Call `set_wake({mode: "webhook", url: <the webhook URL of the routine>, token: <the key of the routine>})`. On an error stop and report the error text.',
          success: 'set_wake returns without an error.',
        },
        chatSelfTest(section.locale),
      ],
    }),
});

const GROK_BOT_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Faça isto no Grok Bot',
  [OwnerLocale.EnglishUs]: 'Do this in Grok Bot',
  [OwnerLocale.Spanish]: 'Haz esto en Grok Bot',
  [OwnerLocale.German]: 'Mach das in Grok Bot',
  [OwnerLocale.French]: 'Faites ceci dans Grok Bot',
  [OwnerLocale.Japanese]: 'Grok Botで次の操作をします',
  [OwnerLocale.Korean]: 'Grok Bot에서 이렇게 하세요',
  [OwnerLocale.ChineseSimplified]: '在 Grok Bot 中这样做',
};

const GROK_BOT_QUICK_START_PATH: Record<OwnerLocale, string[]> = {
  [OwnerLocale.PortugueseBrazil]: ['Abra o Grok Bot', 'Adicione um servidor MCP chamado zapbip', 'Cole este endereço'],
  [OwnerLocale.EnglishUs]: ['Open Grok Bot', 'Add an MCP server named zapbip', 'Paste this address'],
  [OwnerLocale.Spanish]: ['Abre Grok Bot', 'Añade un servidor MCP llamado zapbip', 'Pega esta dirección'],
  [OwnerLocale.German]: ['Öffne Grok Bot', 'MCP-Server namens zapbip hinzufügen', 'Diese Adresse einfügen'],
  [OwnerLocale.French]: ['Ouvrez Grok Bot', 'Ajoutez un serveur MCP nommé zapbip', 'Collez cette adresse'],
  [OwnerLocale.Japanese]: ['Grok Botを開く', 'zapbipという名前のMCPサーバーを追加', 'このアドレスを貼り付ける'],
  [OwnerLocale.Korean]: ['Grok Bot 열기', 'zapbip이라는 이름의 MCP 서버 추가', '이 주소 붙여넣기'],
  [OwnerLocale.ChineseSimplified]: ['打开 Grok Bot', '添加一个名为 zapbip 的 MCP 服务器', '粘贴这个地址'],
};

export const GROK_BOT_QUICK_START = quickStartOf({ hint: GROK_BOT_QUICK_START_HINT, path: GROK_BOT_QUICK_START_PATH, code: addressText });

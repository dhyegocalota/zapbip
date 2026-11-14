import { OwnerLocale } from '@zapbip/types';
import {
  chatSelfTest,
  formatSection,
  localizeCopy,
  noticeStep,
  terminalListenStep,
  tellOwnerAndWait,
  type InstallProduct,
} from '@zapbip/core';
import { addressText, quickStartOf } from '../../src/quick-start';

export const CURSOR_PRODUCT: InstallProduct = {
  productName: 'Cursor',
  productDescription: 'Cursor, the AI code editor and its chat panel',
};

type CursorText = {
  wakeNote: string;
  confirmChange: string;
  restart: string;
};

const CURSOR_TEXT: Record<OwnerLocale, CursorText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O Cursor escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo.',
    confirmChange: 'Vou adicionar o servidor zapbip às configurações de MCP do Cursor. Posso?',
    restart: 'Reinicie o chat do Cursor para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'Cursor listens through the background terminal and answers within seconds while it runs, with no time limit.',
    confirmChange: 'I will add the zapbip server to the Cursor MCP settings. May I?',
    restart: 'Restart the Cursor chat to use zapbip.',
  },
  [OwnerLocale.Spanish]: {
    wakeNote: 'Cursor escucha a través de la terminal en segundo plano y responde en segundos mientras se ejecuta, sin límite de tiempo.',
    confirmChange: 'Voy a añadir el servidor zapbip a los ajustes MCP de Cursor. ¿Puedo?',
    restart: 'Reinicia el chat de Cursor para usar zapbip.',
  },
  [OwnerLocale.German]: {
    wakeNote: 'Cursor hört über das Hintergrund-Terminal zu und antwortet in Sekunden, solange es läuft, ohne Zeitlimit.',
    confirmChange: 'Ich füge den zapbip-Server zu den MCP-Einstellungen von Cursor hinzu. Darf ich?',
    restart: 'Starte den Cursor-Chat neu, um zapbip zu nutzen.',
  },
  [OwnerLocale.French]: {
    wakeNote: 'Cursor écoute via le terminal en arrière-plan et répond en quelques secondes tant qu’il tourne, sans limite de temps.',
    confirmChange: 'Je vais ajouter le serveur zapbip aux réglages MCP de Cursor. Puis-je\u202f?',
    restart: 'Redémarrez la conversation Cursor pour utiliser zapbip.',
  },
  [OwnerLocale.Japanese]: {
    wakeNote: 'Cursorはバックグラウンドのターミナルを通じて待ち受け、実行中は数秒で応答します。時間制限はありません。',
    confirmChange: 'zapbipサーバーをCursorのMCP設定に追加します。よろしいですか？',
    restart: 'zapbipを使うには、Cursorのチャットを再起動してください。',
  },
  [OwnerLocale.Korean]: {
    wakeNote: 'Cursor는 백그라운드 터미널을 통해 듣고, 실행되는 동안 몇 초 안에 답합니다. 시간 제한은 없습니다.',
    confirmChange: 'zapbip 서버를 Cursor의 MCP 설정에 추가하겠습니다. 진행해도 될까요?',
    restart: 'zapbip을 쓰려면 Cursor 채팅을 다시 시작하세요.',
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: 'Cursor 通过后台终端监听，运行期间几秒内就会回应，不限时。',
    confirmChange: '我将把 zapbip 服务器添加到 Cursor 的 MCP 设置中。可以吗？',
    restart: '请重新启动 Cursor 聊天以使用 zapbip。',
  },
  [OwnerLocale.Arabic]: {
    wakeNote: 'يستمع Cursor عبر الطرفية الخلفية ويرد خلال ثوانٍ ما دامت تعمل، دون حد زمني.',
    confirmChange: 'سأضيف خادم zapbip إلى إعدادات MCP في Cursor. هل أستطيع ذلك؟',
    restart: 'أعد تشغيل محادثة Cursor لاستخدام zapbip.',
  },
};

export const CURSOR_COPY = localizeCopy({
  texts: CURSOR_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...CURSOR_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
          success: 'the owner said yes in the chat.',
        },
        {
          action: `Add an MCP server named zapbip over HTTP at ${section.connectionLink} in the Cursor MCP settings.`,
          success: 'the Cursor MCP settings list zapbip.',
        },
        terminalListenStep(section),
        noticeStep(text.restart),
        chatSelfTest(section.locale),
      ],
    }),
});

const CURSOR_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Faça isto no Cursor',
  [OwnerLocale.EnglishUs]: 'Do this in Cursor',
  [OwnerLocale.Spanish]: 'Haz esto en Cursor',
  [OwnerLocale.German]: 'Mach das in Cursor',
  [OwnerLocale.French]: 'Faites ceci dans Cursor',
  [OwnerLocale.Japanese]: 'Cursorで次の操作をします',
  [OwnerLocale.Korean]: 'Cursor에서 이렇게 하세요',
  [OwnerLocale.ChineseSimplified]: '在 Cursor 中这样做',
  [OwnerLocale.Arabic]: 'افعل هذا في Cursor',
};

const CURSOR_QUICK_START_PATH: Record<OwnerLocale, string[]> = {
  [OwnerLocale.PortugueseBrazil]: ['Abra as Configurações do Cursor', 'Vá em MCP', 'Adicione um servidor HTTP', 'Cole este endereço'],
  [OwnerLocale.EnglishUs]: ['Open Cursor Settings', 'Go to MCP', 'Add a server over HTTP', 'Paste this address'],
  [OwnerLocale.Spanish]: ['Abre los ajustes de Cursor', 'Ve a MCP', 'Añade un servidor por HTTP', 'Pega esta dirección'],
  [OwnerLocale.German]: ['Öffne die Cursor-Einstellungen', 'Gehe zu MCP', 'Server über HTTP hinzufügen', 'Diese Adresse einfügen'],
  [OwnerLocale.French]: ['Ouvrez les réglages de Cursor', 'Allez dans MCP', 'Ajoutez un serveur via HTTP', 'Collez cette adresse'],
  [OwnerLocale.Japanese]: ['Cursorの設定を開く', 'MCPへ移動', 'HTTPでサーバーを追加', 'このアドレスを貼り付ける'],
  [OwnerLocale.Korean]: ['Cursor 설정 열기', 'MCP로 이동', 'HTTP로 서버 추가', '이 주소 붙여넣기'],
  [OwnerLocale.ChineseSimplified]: ['打开 Cursor 设置', '前往 MCP', '通过 HTTP 添加服务器', '粘贴这个地址'],
  [OwnerLocale.Arabic]: ['افتح إعدادات Cursor', 'انتقل إلى MCP', 'أضف خادمًا عبر HTTP', 'الصق هذا العنوان'],
};

export const CURSOR_QUICK_START = quickStartOf({ hint: CURSOR_QUICK_START_HINT, path: CURSOR_QUICK_START_PATH, code: addressText });

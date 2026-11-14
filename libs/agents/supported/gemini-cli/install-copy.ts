import { INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import {
  formatSection,
  localizeCopy,
  noticeStep,
  terminalListenStep,
  tellOwnerAndWait,
  FAILURE_OUTPUT_LINES,
  type InstallProduct,
} from '@zapbip/core';
import { quickStartOf } from '../../src/quick-start';

export const GEMINI_CLI_PRODUCT: InstallProduct = {
  productName: 'Gemini CLI',
  productDescription: 'Gemini CLI, the agent started by the `gemini` command',
};

export function geminiCliAddCommand(input: { connectionLink: string }): string {
  return `gemini mcp add --transport http --scope user zapbip ${input.connectionLink}`;
}

type GeminiCliText = {
  wakeNote: string;
  confirmChange: string;
  restart: string;
};

const GEMINI_CLI_TEXT: Record<OwnerLocale, GeminiCliText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote:
      'O Gemini CLI escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo.',
    confirmChange: 'Vou adicionar o servidor MCP zapbip ao Gemini CLI. Posso?',
    restart: 'Reinicie o Gemini CLI para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'Gemini CLI listens through the background terminal and answers within seconds while it runs, with no time limit.',
    confirmChange: 'I will add the zapbip MCP server to Gemini CLI. May I?',
    restart: 'Restart Gemini CLI to use zapbip.',
  },
  [OwnerLocale.Spanish]: {
    wakeNote:
      'Gemini CLI escucha a través de la terminal en segundo plano y responde en segundos mientras se ejecuta, sin límite de tiempo.',
    confirmChange: 'Voy a añadir el servidor MCP de zapbip a Gemini CLI. ¿Puedo?',
    restart: 'Reinicia Gemini CLI para usar zapbip.',
  },
  [OwnerLocale.German]: {
    wakeNote: 'Gemini CLI hört über das Hintergrund-Terminal zu und antwortet in Sekunden, solange es läuft, ohne Zeitlimit.',
    confirmChange: 'Ich füge den zapbip-MCP-Server zu Gemini CLI hinzu. Darf ich?',
    restart: 'Starte Gemini CLI neu, um zapbip zu nutzen.',
  },
  [OwnerLocale.French]: {
    wakeNote: 'Gemini CLI écoute via le terminal en arrière-plan et répond en quelques secondes tant qu’il tourne, sans limite de temps.',
    confirmChange: 'Je vais ajouter le serveur MCP zapbip à Gemini CLI. Puis-je\u202f?',
    restart: 'Redémarrez Gemini CLI pour utiliser zapbip.',
  },
  [OwnerLocale.Japanese]: {
    wakeNote: 'Gemini CLIはバックグラウンドのターミナルを通じて待ち受け、実行中は数秒で応答します。時間制限はありません。',
    confirmChange: 'zapbipのMCPサーバーをGemini CLIに追加します。よろしいですか？',
    restart: 'zapbipを使うには、Gemini CLIを再起動してください。',
  },
  [OwnerLocale.Korean]: {
    wakeNote: 'Gemini CLI는 백그라운드 터미널을 통해 듣고, 실행되는 동안 몇 초 안에 답해요. 시간 제한은 없어요.',
    confirmChange: 'zapbip MCP 서버를 Gemini CLI에 추가할게요. 진행해도 될까요?',
    restart: 'zapbip을 쓰려면 Gemini CLI를 다시 시작하세요.',
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: 'Gemini CLI 通过后台终端监听，运行期间几秒内就会回应，不限时。',
    confirmChange: '我将把 zapbip MCP 服务器添加到 Gemini CLI。可以吗？',
    restart: '请重新启动 Gemini CLI 以使用 zapbip。',
  },
};

export const GEMINI_CLI_COPY = localizeCopy({
  texts: GEMINI_CLI_TEXT,
  build: ({ section, text }) => {
    const selfTest = `gemini -p "Call send_message with the text '${INSTALL_SELF_TEST_TEXT[section.locale]}'"`;
    return formatSection({
      ...GEMINI_CLI_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
          success: 'the owner said yes in the chat.',
        },
        {
          action: 'Run `gemini mcp list`. If it lists zapbip, run `gemini mcp remove --scope user zapbip`.',
          success: '`gemini mcp list` no longer lists zapbip.',
        },
        {
          action: `Run \`${geminiCliAddCommand({ connectionLink: section.connectionLink })}\`.`,
          success: '`gemini mcp list` shows zapbip.',
        },
        terminalListenStep(section),
        noticeStep(text.restart),
        {
          action: `In a fresh process run \`${selfTest}\`. On a non-zero exit stop and show the last ${FAILURE_OUTPUT_LINES} lines of its output.`,
          success: 'the command exits with zero.',
        },
      ],
    });
  },
});

const GEMINI_CLI_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Rode no seu terminal',
  [OwnerLocale.EnglishUs]: 'Run in your terminal',
  [OwnerLocale.Spanish]: 'Ejecuta esto en tu terminal',
  [OwnerLocale.German]: 'Führe das in deinem Terminal aus',
  [OwnerLocale.French]: 'Exécutez ceci dans votre terminal',
  [OwnerLocale.Japanese]: 'ターミナルで実行します',
  [OwnerLocale.Korean]: '터미널에서 실행하세요',
  [OwnerLocale.ChineseSimplified]: '在你的终端里运行',
};

export const GEMINI_CLI_QUICK_START = quickStartOf({
  hint: GEMINI_CLI_QUICK_START_HINT,
  code: (connectionLink) => geminiCliAddCommand({ connectionLink }),
});

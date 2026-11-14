import { INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import { formatSection, localizeCopy, noticeStep, tellOwnerAndWait, FAILURE_OUTPUT_LINES, type InstallProduct } from '@zapbip/core';
import { connectCommand } from '../../src/connect-command';
import { ConnectorClient } from '../../src/generated/ids';
import { quickStartOf } from '../../src/quick-start';

export const CODEX_PRODUCT: InstallProduct = {
  productName: 'Codex',
  productDescription: 'Codex, the agent started by the `codex` command',
};
export const CODEX_TOOL_TIMEOUT_SECONDS = 900;

const CONFIG_PATH = '~/.codex/config.toml';

export function codexConfigTable(input: { connectionLink: string }): string {
  return [
    '[mcp_servers.zapbip]',
    `url = "${input.connectionLink}"`,
    `tool_timeout_sec = ${CODEX_TOOL_TIMEOUT_SECONDS}`,
    'default_tools_approval_mode = "approve"',
  ].join('\n');
}

type CodexText = {
  wakeNote: string;
  confirmChange: string;
  restart: string;
};

const CODEX_TEXT: Record<OwnerLocale, CodexText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O conector retoma a sessão do Codex a cada mensagem, em cerca de 6 segundos, sem limite de tempo.',
    confirmChange: `Vou gravar o servidor zapbip em ${CONFIG_PATH}. Isso faz as ferramentas do zapbip rodarem sem supervisão, sem pedir aprovação a cada uso. Posso?`,
    restart: 'Reinicie o Codex para usar o zapbip.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'The connector resumes the Codex session on each message, in about 6 seconds, with no time limit.',
    confirmChange: `I will write the zapbip server to ${CONFIG_PATH}. This lets zapbip tools run unattended, without asking for approval on each use. May I?`,
    restart: 'Restart Codex to use zapbip.',
  },
  [OwnerLocale.Spanish]: {
    wakeNote: 'El conector reanuda la sesión de Codex con cada mensaje, en unos 6 segundos y sin límite de tiempo.',
    confirmChange: `Voy a escribir el servidor zapbip en ${CONFIG_PATH}. Esto permite que las herramientas de zapbip se ejecuten sin supervisión, sin pedir aprobación en cada uso. ¿Puedo?`,
    restart: 'Reinicia Codex para usar zapbip.',
  },
  [OwnerLocale.German]: {
    wakeNote: 'Der Connector setzt die Codex-Sitzung bei jeder Nachricht fort, in etwa 6 Sekunden und ohne Zeitlimit.',
    confirmChange: `Ich schreibe den zapbip-Server nach ${CONFIG_PATH}. So laufen die zapbip-Werkzeuge unbeaufsichtigt, ohne bei jeder Nutzung um Genehmigung zu bitten. Darf ich?`,
    restart: 'Starte Codex neu, um zapbip zu nutzen.',
  },
  [OwnerLocale.French]: {
    wakeNote: 'Le connecteur reprend la session Codex à chaque message, en environ 6 secondes et sans limite de temps.',
    confirmChange: `Je vais écrire le serveur zapbip dans ${CONFIG_PATH}. Les outils zapbip pourront ainsi s’exécuter sans surveillance, sans demander d’approbation à chaque utilisation. Puis-je\u202f?`,
    restart: 'Redémarrez Codex pour utiliser zapbip.',
  },
  [OwnerLocale.Japanese]: {
    wakeNote: 'コネクタはメッセージが届くたびにCodexのセッションを約6秒で再開します。時間制限はありません。',
    confirmChange: `zapbipサーバーを${CONFIG_PATH}に書き込みます。これにより、zapbipのツールは、使うたびに承認を求めることなく、無人で実行されます。よろしいですか？`,
    restart: 'zapbipを使うには、Codexを再起動してください。',
  },
  [OwnerLocale.Korean]: {
    wakeNote: '커넥터가 메시지마다 약 6초 만에 Codex 세션을 재개해요. 시간 제한은 없어요.',
    confirmChange: `zapbip 서버를 ${CONFIG_PATH}에 작성할게요. 그러면 zapbip 도구가 사용할 때마다 승인을 묻지 않고 무인으로 실행돼요. 진행해도 될까요?`,
    restart: 'zapbip을 쓰려면 Codex를 다시 시작하세요.',
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: '连接器会在每条消息到来时恢复 Codex 会话，大约 6 秒，不限时。',
    confirmChange: `我将把 zapbip 服务器写入 ${CONFIG_PATH}。这样 zapbip 的工具可以无人值守地运行，每次使用都不再请求批准。可以吗？`,
    restart: '请重新启动 Codex 以使用 zapbip。',
  },
  [OwnerLocale.Arabic]: {
    wakeNote: 'يستأنف الموصّل جلسة Codex مع كل رسالة، خلال نحو 6 ثوانٍ ودون حد زمني.',
    confirmChange: `سأكتب خادم zapbip في ${CONFIG_PATH}. هذا يتيح لأدوات zapbip العمل دون إشراف، من دون طلب موافقة عند كل استخدام. هل أستطيع ذلك؟`,
    restart: 'أعد تشغيل Codex لاستخدام zapbip.',
  },
};

export const CODEX_COPY = localizeCopy({
  texts: CODEX_TEXT,
  build: ({ section, text }) => {
    const configTable = codexConfigTable({ connectionLink: section.connectionLink });
    const selfTest = `codex exec -c 'mcp_servers.zapbip.default_tools_approval_mode="approve"' "Call send_message with the text '${INSTALL_SELF_TEST_TEXT[section.locale]}'"`;
    return formatSection({
      ...CODEX_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
          success: 'the owner said yes in the chat.',
        },
        {
          action: `Remove any existing [mcp_servers.zapbip] table from ${CONFIG_PATH}, then append this table, so the file never holds a second one:\n\n\`\`\`toml\n${configTable}\n\`\`\``,
          success: `${CONFIG_PATH} holds exactly one [mcp_servers.zapbip] table with that content.`,
        },
        {
          action: `In the background run \`${connectCommand({ connectionLink: section.connectionLink, client: ConnectorClient.Codex })}\`. It keeps listening and resumes the session with \`codex exec resume\`.`,
          success: 'the connector is running in the background and prints no error.',
        },
        noticeStep(text.restart),
        {
          action: `In a fresh process run \`${selfTest}\`. On a non-zero exit stop and show the last ${FAILURE_OUTPUT_LINES} lines of its output.`,
          success: 'the command exits with zero.',
        },
      ],
    });
  },
});

const CODEX_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: `Adicione ao ${CONFIG_PATH}`,
  [OwnerLocale.EnglishUs]: `Add it to ${CONFIG_PATH}`,
  [OwnerLocale.Spanish]: `Añádelo a ${CONFIG_PATH}`,
  [OwnerLocale.German]: `Füge es zu ${CONFIG_PATH} hinzu`,
  [OwnerLocale.French]: `Ajoutez-le à ${CONFIG_PATH}`,
  [OwnerLocale.Japanese]: `${CONFIG_PATH}に追加します`,
  [OwnerLocale.Korean]: `${CONFIG_PATH}에 추가하세요`,
  [OwnerLocale.ChineseSimplified]: `把它添加到 ${CONFIG_PATH}`,
  [OwnerLocale.Arabic]: `أضفه إلى ${CONFIG_PATH}`,
};

export const CODEX_QUICK_START = quickStartOf({
  hint: CODEX_QUICK_START_HINT,
  code: (connectionLink) => codexConfigTable({ connectionLink }),
});

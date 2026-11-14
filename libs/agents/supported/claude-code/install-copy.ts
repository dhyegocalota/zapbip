import { INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import {
  formatSection,
  localizeCopy,
  monitoredListenStep,
  noticeStep,
  tellOwnerAndWait,
  CONNECTION_URL_VARIABLE,
  FAILURE_OUTPUT_LINES,
  AGENT_RULES,
  type InstallProduct,
} from '@zapbip/core';
import { connectCommand } from '../../src/connect-command';
import { ConnectorClient } from '../../src/generated/ids';
import { quickStartOf } from '../../src/quick-start';

export const CLAUDE_CODE_PRODUCT: InstallProduct = {
  productName: 'Claude Code',
  productDescription: 'Claude Code, the agent started by the `claude` command',
};

export function claudeCodeAddCommand(input: { connectionLink: string }): string {
  return `claude mcp add --transport http --scope user zapbip ${input.connectionLink}`;
}

const SKILL_PATH = '~/.claude/skills/zapbip/SKILL.md';
const LISTENER_RULE = 'A connection holds one listener and a second replaces the first: use exactly one of these, never two together.';
const CHANNEL_COMMAND = 'claude --dangerously-load-development-channels server:zapbip-channel';

type ClaudeCodeText = {
  wakeNote: string;
  confirmChange: string;
  restart: string;
};

const CLAUDE_CODE_TEXT: Record<OwnerLocale, ClaudeCodeText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote:
      'O Claude Code escuta sem limite de tempo: o canal entrega na hora com a sessão aberta, e o conector retoma uma sessão parada em cerca de 7 segundos.',
    confirmChange: `Vou adicionar o servidor MCP zapbip ao Claude Code e gravar o arquivo ${SKILL_PATH}. Posso?`,
    restart: `Reinicie o Claude Code com \`${CHANNEL_COMMAND}\` para usar o zapbip. Essa opção liga o recurso de canais do Claude Code para o zapbip e não aprova nenhuma ferramenta sozinha.`,
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote:
      'Claude Code listens with no time limit: the channel delivers at once while the session is open, and the connector resumes a stopped session in about 7 seconds.',
    confirmChange: `I will add the zapbip MCP server to Claude Code and write the file ${SKILL_PATH}. May I?`,
    restart: `Restart Claude Code with \`${CHANNEL_COMMAND}\` to use zapbip. The flag turns on Claude Code's channel feature for zapbip and does not approve any tool by itself.`,
  },
  [OwnerLocale.Spanish]: {
    wakeNote:
      'Claude Code escucha sin límite de tiempo: el canal entrega al instante mientras la sesión está abierta, y el conector reanuda una sesión detenida en unos 7 segundos.',
    confirmChange: `Voy a añadir el servidor MCP de zapbip a Claude Code y a escribir el archivo ${SKILL_PATH}. ¿Puedo?`,
    restart: `Reinicia Claude Code con \`${CHANNEL_COMMAND}\` para usar zapbip. La opción activa la función de canales de Claude Code para zapbip y no aprueba ninguna herramienta por sí sola.`,
  },
  [OwnerLocale.German]: {
    wakeNote:
      'Claude Code hört ohne Zeitlimit zu: Der Kanal liefert sofort, solange die Sitzung offen ist, und der Connector setzt eine gestoppte Sitzung in etwa 7 Sekunden fort.',
    confirmChange: `Ich füge den zapbip-MCP-Server zu Claude Code hinzu und schreibe die Datei ${SKILL_PATH}. Darf ich?`,
    restart: `Starte Claude Code mit \`${CHANNEL_COMMAND}\` neu, um zapbip zu nutzen. Die Option schaltet die Kanalfunktion von Claude Code für zapbip ein und genehmigt von sich aus kein Werkzeug.`,
  },
  [OwnerLocale.French]: {
    wakeNote:
      'Claude Code écoute sans limite de temps\u00a0: le canal livre aussitôt tant que la session est ouverte, et le connecteur reprend une session arrêtée en environ 7 secondes.',
    confirmChange: `Je vais ajouter le serveur MCP zapbip à Claude Code et écrire le fichier ${SKILL_PATH}. Puis-je\u202f?`,
    restart: `Redémarrez Claude Code avec \`${CHANNEL_COMMAND}\` pour utiliser zapbip. L’option active la fonction de canaux de Claude Code pour zapbip et n’approuve aucun outil par elle-même.`,
  },
  [OwnerLocale.Japanese]: {
    wakeNote:
      'Claude Codeは時間制限なしで待ち受けます。セッションが開いている間はチャンネルが即座に配信し、止まったセッションはコネクタが約7秒で再開します。',
    confirmChange: `zapbipのMCPサーバーをClaude Codeに追加し、ファイル${SKILL_PATH}を書き込みます。よろしいですか？`,
    restart: `zapbipを使うには、\`${CHANNEL_COMMAND}\`でClaude Codeを再起動してください。このオプションはzapbip向けにClaude Codeのチャンネル機能をオンにするだけで、ツールを自動で承認することはありません。`,
  },
  [OwnerLocale.Korean]: {
    wakeNote:
      'Claude Code는 시간 제한 없이 듣습니다. 세션이 열려 있는 동안에는 채널이 즉시 전달하고, 멈춘 세션은 커넥터가 약 7초 만에 재개합니다.',
    confirmChange: `zapbip MCP 서버를 Claude Code에 추가하고 ${SKILL_PATH} 파일을 작성하겠습니다. 진행해도 될까요?`,
    restart: `zapbip을 쓰려면 \`${CHANNEL_COMMAND}\`로 Claude Code를 다시 시작하세요. 이 옵션은 zapbip용으로 Claude Code의 채널 기능을 켤 뿐, 어떤 도구도 스스로 승인하지 않습니다.`,
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: 'Claude Code 不限时地监听：会话打开时，通道会立即送达；会话停止时，连接器大约 7 秒就能让它恢复。',
    confirmChange: `我将把 zapbip MCP 服务器添加到 Claude Code，并写入文件 ${SKILL_PATH}。可以吗？`,
    restart: `请用 \`${CHANNEL_COMMAND}\` 重新启动 Claude Code 以使用 zapbip。这个选项只是为 zapbip 打开 Claude Code 的通道功能，本身不会批准任何工具。`,
  },
};

export const CLAUDE_CODE_SKILL_DESCRIPTION: Record<OwnerLocale, () => string> = {
  [OwnerLocale.PortugueseBrazil]: () =>
    'Regras para falar com a pessoa para quem você trabalha pelo WhatsApp usando o zapbip: perguntar, esperar a resposta e escrever curto.',
  [OwnerLocale.EnglishUs]: () => 'Rules for talking to the owner on WhatsApp through zapbip: ask, wait for the answer and write short.',
  [OwnerLocale.Spanish]: () =>
    'Reglas para hablar por WhatsApp con la persona para la que trabajas a través de zapbip: preguntar, esperar la respuesta y escribir corto.',
  [OwnerLocale.German]: () =>
    'Regeln für das Gespräch mit der Person, für die du arbeitest, auf WhatsApp über zapbip: fragen, auf die Antwort warten und sich kurzfassen.',
  [OwnerLocale.French]: () =>
    'Règles pour parler sur WhatsApp à la personne pour qui vous travaillez via zapbip\u00a0: poser les questions, attendre la réponse et écrire court.',
  [OwnerLocale.Japanese]: () => 'zapbip経由でWhatsAppで仕えている人と話すときのルール: 質問し、返事を待ち、短く書く。',
  [OwnerLocale.Korean]: () => 'zapbip으로 WhatsApp에서 함께 일하는 사람과 대화할 때의 규칙: 질문하고, 답을 기다리고, 짧게 쓰기.',
  [OwnerLocale.ChineseSimplified]: () => '通过 zapbip 在 WhatsApp 上与你所服务的人交流的规则：提问、等待回答、写得简短。',
};

export const CLAUDE_CODE_COPY = localizeCopy({
  texts: CLAUDE_CODE_TEXT,
  build: ({ section, text }) => {
    const skillContent = [
      '---',
      'name: zapbip',
      `description: ${CLAUDE_CODE_SKILL_DESCRIPTION[section.locale]()}`,
      '---',
      AGENT_RULES,
    ].join('\n');
    const selfTest = `claude -p "Call send_message with the text '${INSTALL_SELF_TEST_TEXT[section.locale]}'" --allowedTools=mcp__zapbip__send_message`;
    return formatSection({
      ...CLAUDE_CODE_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        {
          action: `${tellOwnerAndWait(text.confirmChange)} If the owner does not say yes, stop.`,
          success: 'the owner said yes in the chat.',
        },
        {
          action:
            'Run `claude mcp list`. If it lists zapbip or zapbip-channel, run `claude mcp remove --scope user zapbip` or `claude mcp remove --scope user zapbip-channel` for each.',
          success: '`claude mcp list` no longer lists them.',
        },
        {
          action: `Run \`${claudeCodeAddCommand({ connectionLink: section.connectionLink })}\` for the tools.`,
          success: '`claude mcp list` shows zapbip.',
        },
        {
          action: `Run \`claude mcp add --scope user zapbip-channel -e ${CONNECTION_URL_VARIABLE}=${section.connectionLink} -- npx zapbip@${ZAPBIP_NPM_VERSION} channel\` for the live channel.`,
          success: '`claude mcp list` shows zapbip-channel.',
        },
        {
          action: `Write ${SKILL_PATH} with exactly this content:\n\n\`\`\`\n${skillContent}\n\`\`\``,
          success: 'the file holds exactly that content.',
        },
        {
          action: `${LISTENER_RULE} If the session supports development channels, the zapbip-channel server pushes each owner message into the session once Claude Code is started with \`${CHANNEL_COMMAND}\`. If it does not, in the background run \`${connectCommand({ connectionLink: section.connectionLink, client: ConnectorClient.ClaudeCode })}\`, which resumes a stopped session with \`claude -p --resume\`. If connect cannot run either, listen instead. ${monitoredListenStep(section)}`,
          success: 'exactly one listener is running.',
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

const CLAUDE_CODE_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Rode no seu terminal',
  [OwnerLocale.EnglishUs]: 'Run in your terminal',
  [OwnerLocale.Spanish]: 'Ejecuta esto en tu terminal',
  [OwnerLocale.German]: 'Führe das in deinem Terminal aus',
  [OwnerLocale.French]: 'Exécutez ceci dans votre terminal',
  [OwnerLocale.Japanese]: 'ターミナルで実行します',
  [OwnerLocale.Korean]: '터미널에서 실행하세요',
  [OwnerLocale.ChineseSimplified]: '在你的终端里运行',
};

export const CLAUDE_CODE_QUICK_START = quickStartOf({
  hint: CLAUDE_CODE_QUICK_START_HINT,
  code: (connectionLink) => claudeCodeAddCommand({ connectionLink }),
});

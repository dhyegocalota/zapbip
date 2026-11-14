import { OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, noticeStep, questionStep, tellOwner, type InstallProduct } from '@zapbip/core';
import { addressText, quickStartOf } from '../../src/quick-start';

export const CLAUDE_AI_PRODUCT: InstallProduct = {
  productName: 'claude.ai',
  productDescription: 'claude.ai, the chat in the claude.ai web app',
};

type ClaudeAiText = {
  wakeNote: string;
  pasteConnector: (connectionLink: string) => string;
  pasteTrigger: string;
  withoutTrigger: string;
  createHourlyTask: string;
};

const CLAUDE_AI_TEXT: Record<OwnerLocale, ClaudeAiText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote:
      'O webhook da rotina acorda o claude.ai em cerca de 16 segundos; a tarefa agendada de segurança roda no máximo uma vez a cada 60 minutos, limite da plataforma.',
    pasteConnector: (connectionLink) => `Cole este endereço como conector personalizado nas configurações do claude.ai: ${connectionLink}`,
    pasteTrigger:
      'Crie uma tarefa com gatilho de API em claude.ai/code/routines, clique em Generate token e cole aqui a URL de disparo (fire URL) e o token. O token aparece uma vez.',
    withoutTrigger: 'Sem o gatilho, este chat só vê mensagens novas quando você o abrir.',
    createHourlyTask: 'Crie também uma tarefa por hora que chama check_inbox, como rede de segurança.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote:
      'The routine webhook wakes claude.ai in about 16 seconds; the safety-net scheduled task runs at most once every 60 minutes, a platform minimum.',
    pasteConnector: (connectionLink) => `Paste this address as a custom connector in the claude.ai settings: ${connectionLink}`,
    pasteTrigger:
      'Create a task with an API trigger at claude.ai/code/routines, click Generate token and paste the fire URL and token here. The token is shown once.',
    withoutTrigger: 'Without the trigger, this chat sees new messages only when you open it.',
    createHourlyTask: 'Also create an hourly task that calls check_inbox, as a safety net.',
  },
  [OwnerLocale.Spanish]: {
    wakeNote:
      'El webhook de la rutina despierta a claude.ai en unos 16 segundos; la tarea programada de respaldo se ejecuta como máximo una vez cada 60 minutos, un mínimo de la plataforma.',
    pasteConnector: (connectionLink) => `Pega esta dirección como conector personalizado en los ajustes de claude.ai: ${connectionLink}`,
    pasteTrigger:
      'Crea una tarea con un disparador de API en claude.ai/code/routines, haz clic en Generate token y pega aquí la URL de disparo y el token. El token se muestra una sola vez.',
    withoutTrigger: 'Sin el disparador, este chat ve los mensajes nuevos solo cuando lo abres.',
    createHourlyTask: 'Crea también una tarea cada hora que llame a check_inbox, como red de seguridad.',
  },
  [OwnerLocale.German]: {
    wakeNote:
      'Der Routine-Webhook weckt claude.ai in etwa 16 Sekunden; die geplante Sicherheitsaufgabe läuft höchstens einmal alle 60 Minuten, ein Minimum der Plattform.',
    pasteConnector: (connectionLink) =>
      `Füge diese Adresse in den claude.ai-Einstellungen als benutzerdefinierten Connector ein: ${connectionLink}`,
    pasteTrigger:
      'Erstelle unter claude.ai/code/routines eine Aufgabe mit API-Trigger, klicke auf Generate token und füge die Fire-URL und das Token hier ein. Das Token wird nur einmal angezeigt.',
    withoutTrigger: 'Ohne den Trigger sieht dieser Chat neue Nachrichten nur, wenn du ihn öffnest.',
    createHourlyTask: 'Erstelle außerdem eine stündliche Aufgabe, die check_inbox aufruft, als Sicherheitsnetz.',
  },
  [OwnerLocale.French]: {
    wakeNote:
      'Le webhook de la routine réveille claude.ai en environ 16 secondes\u202f; la tâche planifiée de secours s’exécute au plus une fois toutes les 60 minutes, un minimum de la plateforme.',
    pasteConnector: (connectionLink) =>
      `Collez cette adresse comme connecteur personnalisé dans les réglages de claude.ai\u00a0: ${connectionLink}`,
    pasteTrigger:
      'Créez une tâche avec un déclencheur API sur claude.ai/code/routines, cliquez sur Generate token et collez ici l’URL de déclenchement et le jeton. Le jeton n’est affiché qu’une fois.',
    withoutTrigger: 'Sans le déclencheur, cette conversation ne voit les nouveaux messages que lorsque vous l’ouvrez.',
    createHourlyTask: 'Créez aussi une tâche horaire qui appelle check_inbox, comme filet de sécurité.',
  },
  [OwnerLocale.Japanese]: {
    wakeNote:
      'ルーティンのWebhookは約16秒でclaude.aiを起動します。保険のスケジュールタスクは、プラットフォームの下限である60分に1回までしか実行されません。',
    pasteConnector: (connectionLink) => `claude.aiの設定で、このアドレスをカスタムコネクタとして貼り付けてください: ${connectionLink}`,
    pasteTrigger:
      'claude.ai/code/routinesでAPIトリガー付きのタスクを作成し、Generate tokenをクリックして、fire URLとトークンをここに貼り付けてください。トークンは一度しか表示されません。',
    withoutTrigger: 'トリガーがない場合、このチャットは、あなたが開いたときにだけ新しいメッセージを見られます。',
    createHourlyTask: '保険として、check_inboxを呼び出す1時間ごとのタスクも作成してください。',
  },
  [OwnerLocale.Korean]: {
    wakeNote: '루틴 웹훅은 약 16초 만에 claude.ai를 깨워요. 안전망 예약 작업은 플랫폼의 최소 주기인 60분에 한 번만 실행돼요.',
    pasteConnector: (connectionLink) => `claude.ai 설정에서 이 주소를 사용자 지정 커넥터로 붙여넣으세요: ${connectionLink}`,
    pasteTrigger:
      'claude.ai/code/routines에서 API 트리거가 있는 작업을 만들고 Generate token을 클릭한 뒤, fire URL과 토큰을 여기에 붙여넣으세요. 토큰은 한 번만 표시돼요.',
    withoutTrigger: '트리거가 없으면 이 채팅은 사용자가 열었을 때만 새 메시지를 봐요.',
    createHourlyTask: '안전망으로 check_inbox를 호출하는 1시간 주기 작업도 만들어 두세요.',
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: '例行任务的 Webhook 大约 16 秒就能唤醒 claude.ai；作为保险的计划任务最多每 60 分钟运行一次，这是平台的最低间隔。',
    pasteConnector: (connectionLink) => `在 claude.ai 设置中，把这个地址粘贴为自定义连接器：${connectionLink}`,
    pasteTrigger:
      '在 claude.ai/code/routines 创建一个带 API 触发器的任务，点击 Generate token，然后把 fire URL 和令牌粘贴到这里。令牌只显示一次。',
    withoutTrigger: '没有触发器的话，只有你打开这个聊天时，它才能看到新消息。',
    createHourlyTask: '另外再创建一个每小时调用 check_inbox 的任务，作为保险。',
  },
  [OwnerLocale.Arabic]: {
    wakeNote:
      'يوقظ webhook الروتين claude.ai خلال نحو 16 ثانية؛ أما المهمة المجدولة الاحتياطية فتعمل مرة واحدة كل 60 دقيقة على الأكثر، وهذا حد أدنى تفرضه المنصة.',
    pasteConnector: (connectionLink) => `الصق هذا العنوان موصّلًا مخصّصًا في إعدادات claude.ai: ${connectionLink}`,
    pasteTrigger:
      'أنشئ مهمة بمُشغّل API من claude.ai/code/routines، واضغط Generate token، ثم الصق هنا عنوان fire URL والرمز. يظهر الرمز مرة واحدة فقط.',
    withoutTrigger: 'من دون المُشغّل، لن ترى هذه المحادثة الرسائل الجديدة إلا عند فتحها.',
    createHourlyTask: 'وأنشئ أيضًا مهمة كل ساعة تستدعي check_inbox كشبكة أمان.',
  },
};

export const CLAUDE_AI_COPY = localizeCopy({
  texts: CLAUDE_AI_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...CLAUDE_AI_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        questionStep(text.pasteConnector(section.connectionLink)),
        questionStep(text.pasteTrigger),
        {
          action: `If the owner stops here, call \`set_wake({mode: "none"})\`. ${tellOwner(text.withoutTrigger)} Then go to the last step.`,
          success: 'set_wake returns without an error, or the owner did not stop here.',
        },
        {
          action:
            'Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text.',
          success: 'set_wake returns without an error.',
        },
        noticeStep(text.createHourlyTask),
        chatSelfTest(section.locale),
      ],
    }),
});

const CLAUDE_AI_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Faça isto no claude.ai',
  [OwnerLocale.EnglishUs]: 'Do this in claude.ai',
  [OwnerLocale.Spanish]: 'Haz esto en claude.ai',
  [OwnerLocale.German]: 'Mach das in claude.ai',
  [OwnerLocale.French]: 'Faites ceci dans claude.ai',
  [OwnerLocale.Japanese]: 'claude.aiで次の操作をします',
  [OwnerLocale.Korean]: 'claude.ai에서 이렇게 하세요',
  [OwnerLocale.ChineseSimplified]: '在 claude.ai 中这样做',
  [OwnerLocale.Arabic]: 'افعل هذا في claude.ai',
};

const CLAUDE_AI_QUICK_START_PATH: Record<OwnerLocale, string[]> = {
  [OwnerLocale.PortugueseBrazil]: [
    'Abra o claude.ai → Configurações',
    'Vá em Conectores',
    'Adicione um conector personalizado',
    'Cole este endereço',
  ],
  [OwnerLocale.EnglishUs]: ['Open claude.ai → Settings', 'Go to Connectors', 'Add a custom connector', 'Paste this address'],
  [OwnerLocale.Spanish]: ['Abre claude.ai → Ajustes', 'Ve a Conectores', 'Añade un conector personalizado', 'Pega esta dirección'],
  [OwnerLocale.German]: [
    'Öffne claude.ai → Einstellungen',
    'Gehe zu Connectors',
    'Benutzerdefinierten Connector hinzufügen',
    'Diese Adresse einfügen',
  ],
  [OwnerLocale.French]: [
    'Ouvrez claude.ai → Réglages',
    'Allez dans Connecteurs',
    'Ajoutez un connecteur personnalisé',
    'Collez cette adresse',
  ],
  [OwnerLocale.Japanese]: ['claude.aiを開く → 設定', 'コネクタへ移動', 'カスタムコネクタを追加', 'このアドレスを貼り付ける'],
  [OwnerLocale.Korean]: ['claude.ai 열기 → 설정', '커넥터로 이동', '사용자 지정 커넥터 추가', '이 주소 붙여넣기'],
  [OwnerLocale.ChineseSimplified]: ['打开 claude.ai → 设置', '前往连接器', '添加自定义连接器', '粘贴这个地址'],
  [OwnerLocale.Arabic]: ['افتح claude.ai ← الإعدادات', 'انتقل إلى الموصّلات', 'أضف موصّلًا مخصّصًا', 'الصق هذا العنوان'],
};

export const CLAUDE_AI_QUICK_START = quickStartOf({
  hint: CLAUDE_AI_QUICK_START_HINT,
  path: CLAUDE_AI_QUICK_START_PATH,
  code: addressText,
});

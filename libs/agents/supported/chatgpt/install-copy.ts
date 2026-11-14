import { OwnerLocale } from '@zapbip/types';
import { chatSelfTest, formatSection, localizeCopy, questionStep, type InstallProduct } from '@zapbip/core';
import { addressText, quickStartOf } from '../../src/quick-start';

export const CHATGPT_PRODUCT: InstallProduct = { productName: 'ChatGPT', productDescription: 'ChatGPT, the chat in the ChatGPT web app' };
export const CHATGPT_POLL_INTERVAL_MINUTES = 60;

type ChatGptText = {
  wakeNote: string;
  addApp: (connectionLink: string) => string;
  createTask: string;
};

const CHATGPT_TEXT: Record<OwnerLocale, ChatGptText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O ChatGPT é acordado por uma tarefa agendada a cada hora: uma mensagem pode esperar até uma hora.',
    addApp: (connectionLink) =>
      `Ative o developer mode nas configurações do ChatGPT e adicione um app pela URL ${connectionLink} com \`No authentication\`.`,
    createTask:
      'Em um chat só para isso, crie uma tarefa por hora com Executar neste computador (`Run on this computer`) que chama check_inbox, e escolha Sempre permitir (`Always allow`) uma vez por ferramenta.',
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'ChatGPT is woken by a scheduled task every hour: a message can wait up to an hour.',
    addApp: (connectionLink) =>
      `Enable developer mode in the ChatGPT settings and add an app by the URL ${connectionLink} with \`No authentication\`.`,
    createTask:
      'In one dedicated chat, create an hourly task with `Run on this computer` that calls check_inbox, and choose `Always allow` once per tool.',
  },
  [OwnerLocale.Spanish]: {
    wakeNote: 'ChatGPT se despierta con una tarea programada cada hora: un mensaje puede esperar hasta una hora.',
    addApp: (connectionLink) =>
      `Activa el modo desarrollador en los ajustes de ChatGPT y añade una app con la URL ${connectionLink} con \`No authentication\`.`,
    createTask:
      'En un chat dedicado, crea una tarea cada hora con `Run on this computer` que llame a check_inbox, y elige `Always allow` una vez por herramienta.',
  },
  [OwnerLocale.German]: {
    wakeNote: 'ChatGPT wird jede Stunde von einer geplanten Aufgabe geweckt: Eine Nachricht kann bis zu einer Stunde warten.',
    addApp: (connectionLink) =>
      `Aktiviere den Entwicklermodus in den ChatGPT-Einstellungen und füge eine App mit der URL ${connectionLink} hinzu, mit \`No authentication\`.`,
    createTask:
      'Erstelle in einem eigenen Chat eine stündliche Aufgabe mit `Run on this computer`, die check_inbox aufruft, und wähle `Always allow` einmal pro Werkzeug.',
  },
  [OwnerLocale.French]: {
    wakeNote: 'ChatGPT est réveillé toutes les heures par une tâche planifiée\u00a0: un message peut attendre jusqu’à une heure.',
    addApp: (connectionLink) =>
      `Activez le mode développeur dans les réglages de ChatGPT et ajoutez une app avec l’URL ${connectionLink} avec \`No authentication\`.`,
    createTask:
      'Dans une conversation dédiée, créez une tâche horaire avec `Run on this computer` qui appelle check_inbox, et choisissez `Always allow` une fois par outil.',
  },
  [OwnerLocale.Japanese]: {
    wakeNote: 'ChatGPTは1時間ごとにスケジュールされたタスクで起動します。メッセージは最長1時間待つことがあります。',
    addApp: (connectionLink) =>
      `ChatGPTの設定で開発者モードを有効にし、URL ${connectionLink} でアプリを追加します。認証は\`No authentication\`にしてください。`,
    createTask:
      '専用のチャットで、`Run on this computer`を選んだ1時間ごとのタスクを作成し、check_inboxを呼び出すようにします。ツールごとに一度、`Always allow`を選んでください。',
  },
  [OwnerLocale.Korean]: {
    wakeNote: 'ChatGPT는 1시간마다 예약 작업으로 깨어나요. 메시지는 최대 1시간 기다릴 수 있어요.',
    addApp: (connectionLink) =>
      `ChatGPT 설정에서 개발자 모드를 켜고 URL ${connectionLink}(으)로 앱을 추가하세요. 인증은 \`No authentication\`으로 설정해요.`,
    createTask:
      '전용 채팅에서 `Run on this computer`로 1시간마다 실행되는 작업을 만들어 check_inbox를 호출하게 하고, 도구마다 한 번씩 `Always allow`를 선택하세요.',
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: 'ChatGPT 每小时由一个计划任务唤醒：一条消息最多可能要等一个小时。',
    addApp: (connectionLink) => `在 ChatGPT 设置中开启开发者模式，用网址 ${connectionLink} 添加一个应用，认证选 \`No authentication\`。`,
    createTask:
      '在一个专用的聊天里创建一个每小时运行的任务，选 `Run on this computer`，让它调用 check_inbox，并对每个工具选一次 `Always allow`。',
  },
  [OwnerLocale.Arabic]: {
    wakeNote: 'يوقظ ChatGPT مهمة مجدولة كل ساعة: قد تنتظر الرسالة حتى ساعة كاملة.',
    addApp: (connectionLink) =>
      `فعّل وضع المطوّر في إعدادات ChatGPT وأضف تطبيقًا عبر العنوان ${connectionLink} مع الخيار \`No authentication\`.`,
    createTask:
      'في محادثة مخصّصة واحدة، أنشئ مهمة كل ساعة بالخيار `Run on this computer` تستدعي check_inbox، واختر `Always allow` مرة واحدة لكل أداة.',
  },
};

export const CHATGPT_COPY = localizeCopy({
  texts: CHATGPT_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...CHATGPT_PRODUCT,
      wakeNote: text.wakeNote,
      steps: [
        questionStep(text.addApp(section.connectionLink)),
        questionStep(text.createTask),
        {
          action: `Call \`set_wake({mode: "scheduled", interval_minutes: ${CHATGPT_POLL_INTERVAL_MINUTES}})\`.`,
          success: 'set_wake returns without an error.',
        },
        chatSelfTest(section.locale),
      ],
    }),
});

const CHATGPT_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Faça isto no ChatGPT',
  [OwnerLocale.EnglishUs]: 'Do this in ChatGPT',
  [OwnerLocale.Spanish]: 'Haz esto en ChatGPT',
  [OwnerLocale.German]: 'Mach das in ChatGPT',
  [OwnerLocale.French]: 'Faites ceci dans ChatGPT',
  [OwnerLocale.Japanese]: 'ChatGPTで次の操作をします',
  [OwnerLocale.Korean]: 'ChatGPT에서 이렇게 하세요',
  [OwnerLocale.ChineseSimplified]: '在 ChatGPT 中这样做',
  [OwnerLocale.Arabic]: 'افعل هذا في ChatGPT',
};

const CHATGPT_QUICK_START_PATH: Record<OwnerLocale, string[]> = {
  [OwnerLocale.PortugueseBrazil]: [
    'Abra o ChatGPT → Configurações',
    'Ative o modo desenvolvedor',
    'Adicione um app por URL, sem autenticação',
    'Cole este endereço',
  ],
  [OwnerLocale.EnglishUs]: [
    'Open ChatGPT → Settings',
    'Turn on developer mode',
    'Add an app by URL, no authentication',
    'Paste this address',
  ],
  [OwnerLocale.Spanish]: [
    'Abre ChatGPT → Ajustes',
    'Activa el modo desarrollador',
    'Añade una app por URL, sin autenticación',
    'Pega esta dirección',
  ],
  [OwnerLocale.German]: [
    'Öffne ChatGPT → Einstellungen',
    'Entwicklermodus aktivieren',
    'App per URL hinzufügen, ohne Authentifizierung',
    'Diese Adresse einfügen',
  ],
  [OwnerLocale.French]: [
    'Ouvrez ChatGPT → Réglages',
    'Activez le mode développeur',
    'Ajoutez une app par URL, sans authentification',
    'Collez cette adresse',
  ],
  [OwnerLocale.Japanese]: ['ChatGPTを開く → 設定', '開発者モードをオンにする', 'URLでアプリを追加（認証なし）', 'このアドレスを貼り付ける'],
  [OwnerLocale.Korean]: ['ChatGPT 열기 → 설정', '개발자 모드 켜기', 'URL로 앱 추가, 인증 없음', '이 주소 붙여넣기'],
  [OwnerLocale.ChineseSimplified]: ['打开 ChatGPT → 设置', '开启开发者模式', '通过网址添加应用，无需认证', '粘贴这个地址'],
  [OwnerLocale.Arabic]: ['افتح ChatGPT ← الإعدادات', 'فعّل وضع المطوّر', 'أضف تطبيقًا عبر العنوان دون مصادقة', 'الصق هذا العنوان'],
};

export const CHATGPT_QUICK_START = quickStartOf({ hint: CHATGPT_QUICK_START_HINT, path: CHATGPT_QUICK_START_PATH, code: addressText });

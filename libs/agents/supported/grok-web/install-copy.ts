import { OwnerLocale } from '@zapbip/types';
import {
  chatSelfTest,
  formatSection,
  localizeCopy,
  questionStep,
  type InstallStep,
  type InstallSectionInput,
  type InstallProduct,
} from '@zapbip/core';
import { addressText, quickStartOf } from '../../src/quick-start';

export const GROK_WEB_PRODUCT: InstallProduct = { productName: 'Grok web', productDescription: 'Grok web, the chat in the Grok web app' };

type GrokWebText = {
  wakeNote: string;
  wakeNoteWithoutStandby: string;
  pasteConnector: (connectionLink: string) => string;
};

const GROK_WEB_TEXT: Record<OwnerLocale, GrokWebText> = {
  [OwnerLocale.PortugueseBrazil]: {
    wakeNote: 'O Grok na web não acorda sozinho: o agente de prontidão escolhido responde por ele em segundos.',
    wakeNoteWithoutStandby: 'Sem um agente de prontidão, o Grok na web só vê mensagens novas quando você abre o chat dele.',
    pasteConnector: (connectionLink) => `Cole este endereço como conector nas configurações do Grok: ${connectionLink}`,
  },
  [OwnerLocale.EnglishUs]: {
    wakeNote: 'Grok on the web cannot be woken from outside: the chosen standby agent answers for it within seconds.',
    wakeNoteWithoutStandby: 'Without a standby agent, Grok on the web sees new messages only when you open the chat.',
    pasteConnector: (connectionLink) => `Paste this address as a connector in the Grok settings: ${connectionLink}`,
  },
  [OwnerLocale.Spanish]: {
    wakeNote: 'Grok en la web no se puede despertar desde fuera: el agente de reserva elegido responde por él en segundos.',
    wakeNoteWithoutStandby: 'Sin un agente de reserva, Grok en la web ve los mensajes nuevos solo cuando abres el chat.',
    pasteConnector: (connectionLink) => `Pega esta dirección como conector en los ajustes de Grok: ${connectionLink}`,
  },
  [OwnerLocale.German]: {
    wakeNote: 'Grok im Web kann nicht von außen geweckt werden: Der gewählte Standby-Agent antwortet in Sekunden für ihn.',
    wakeNoteWithoutStandby: 'Ohne Standby-Agent sieht Grok im Web neue Nachrichten nur, wenn du den Chat öffnest.',
    pasteConnector: (connectionLink) => `Füge diese Adresse in den Grok-Einstellungen als Connector ein: ${connectionLink}`,
  },
  [OwnerLocale.French]: {
    wakeNote:
      'Grok sur le web ne peut pas être réveillé de l’extérieur\u00a0: l’agent de secours choisi répond à sa place en quelques secondes.',
    wakeNoteWithoutStandby: 'Sans agent de secours, Grok sur le web ne voit les nouveaux messages que lorsque vous ouvrez la conversation.',
    pasteConnector: (connectionLink) => `Collez cette adresse comme connecteur dans les réglages de Grok\u00a0: ${connectionLink}`,
  },
  [OwnerLocale.Japanese]: {
    wakeNote: 'Web版のGrokは外部から起動できません。選ばれた待機エージェントが、数秒で代わりに応答します。',
    wakeNoteWithoutStandby: '待機エージェントがない場合、Web版のGrokは、あなたがチャットを開いたときにだけ新しいメッセージを見られます。',
    pasteConnector: (connectionLink) => `Grokの設定で、このアドレスをコネクタとして貼り付けてください: ${connectionLink}`,
  },
  [OwnerLocale.Korean]: {
    wakeNote: '웹의 Grok은 외부에서 깨울 수 없어요. 선택한 대기 에이전트가 몇 초 안에 대신 답해요.',
    wakeNoteWithoutStandby: '대기 에이전트가 없으면 웹의 Grok은 사용자가 채팅을 열었을 때만 새 메시지를 봐요.',
    pasteConnector: (connectionLink) => `Grok 설정에서 이 주소를 커넥터로 붙여넣으세요: ${connectionLink}`,
  },
  [OwnerLocale.ChineseSimplified]: {
    wakeNote: '网页版 Grok 无法从外部唤醒：所选的备用智能体会在几秒内代它回应。',
    wakeNoteWithoutStandby: '没有备用智能体的话，只有你打开聊天时，网页版 Grok 才能看到新消息。',
    pasteConnector: (connectionLink) => `在 Grok 设置中，把这个地址粘贴为连接器：${connectionLink}`,
  },
  [OwnerLocale.Arabic]: {
    wakeNote: 'لا يمكن إيقاظ Grok على الويب من الخارج: الوكيل الاحتياطي المختار يرد نيابةً عنه خلال ثوانٍ.',
    wakeNoteWithoutStandby: 'من دون وكيل احتياطي، لن يرى Grok على الويب الرسائل الجديدة إلا عند فتح المحادثة.',
    pasteConnector: (connectionLink) => `الصق هذا العنوان موصّلًا في إعدادات Grok: ${connectionLink}`,
  },
  [OwnerLocale.Hindi]: {
    wakeNote: 'वेब पर Grok को बाहर से नहीं जगाया जा सकता: चुना गया स्टैंडबाय एजेंट कुछ ही सेकंड में उसकी जगह जवाब देता है।',
    wakeNoteWithoutStandby: 'स्टैंडबाय एजेंट के बिना, वेब पर Grok नए संदेश तभी देखता है जब आप चैट खोलते हैं।',
    pasteConnector: (connectionLink) => `Grok की सेटिंग्स में यह पता कनेक्टर के रूप में पेस्ट करें: ${connectionLink}`,
  },
};

function wakeNoteOf(input: { text: GrokWebText; standbyAgent: InstallSectionInput['standbyAgent'] }): string {
  if (input.standbyAgent === null) return input.text.wakeNoteWithoutStandby;
  return input.text.wakeNote;
}

function setWakeStep(input: { standbyAgent: InstallSectionInput['standbyAgent'] }): InstallStep {
  const success = 'set_wake returns without an error.';
  if (input.standbyAgent === null) return { action: 'Call `set_wake({mode: "none"})`.', success };
  return { action: `Call \`set_wake({mode: "standby", standby_agent: ${JSON.stringify(input.standbyAgent)}})\`.`, success };
}

export const GROK_WEB_COPY = localizeCopy({
  texts: GROK_WEB_TEXT,
  build: ({ section, text }) =>
    formatSection({
      ...GROK_WEB_PRODUCT,
      wakeNote: wakeNoteOf({ text, standbyAgent: section.standbyAgent }),
      steps: [questionStep(text.pasteConnector(section.connectionLink)), setWakeStep(section), chatSelfTest(section.locale)],
    }),
});

const GROK_WEB_QUICK_START_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Faça isto no Grok',
  [OwnerLocale.EnglishUs]: 'Do this in Grok',
  [OwnerLocale.Spanish]: 'Haz esto en Grok',
  [OwnerLocale.German]: 'Mach das in Grok',
  [OwnerLocale.French]: 'Faites ceci dans Grok',
  [OwnerLocale.Japanese]: 'Grokで次の操作をします',
  [OwnerLocale.Korean]: 'Grok에서 이렇게 하세요',
  [OwnerLocale.ChineseSimplified]: '在 Grok 中这样做',
  [OwnerLocale.Arabic]: 'افعل هذا في Grok',
  [OwnerLocale.Hindi]: 'यह Grok में करें',
};

const GROK_WEB_QUICK_START_PATH: Record<OwnerLocale, string[]> = {
  [OwnerLocale.PortugueseBrazil]: ['Abra o Grok → Configurações', 'Adicione um conector', 'Cole este endereço'],
  [OwnerLocale.EnglishUs]: ['Open Grok → Settings', 'Add a connector', 'Paste this address'],
  [OwnerLocale.Spanish]: ['Abre Grok → Ajustes', 'Añade un conector', 'Pega esta dirección'],
  [OwnerLocale.German]: ['Öffne Grok → Einstellungen', 'Connector hinzufügen', 'Diese Adresse einfügen'],
  [OwnerLocale.French]: ['Ouvrez Grok → Réglages', 'Ajoutez un connecteur', 'Collez cette adresse'],
  [OwnerLocale.Japanese]: ['Grokを開く → 設定', 'コネクタを追加', 'このアドレスを貼り付ける'],
  [OwnerLocale.Korean]: ['Grok 열기 → 설정', '커넥터 추가', '이 주소 붙여넣기'],
  [OwnerLocale.ChineseSimplified]: ['打开 Grok → 设置', '添加连接器', '粘贴这个地址'],
  [OwnerLocale.Arabic]: ['افتح Grok ← الإعدادات', 'أضف موصّلًا', 'الصق هذا العنوان'],
  [OwnerLocale.Hindi]: ['Grok खोलें → सेटिंग्स', 'कनेक्टर जोड़ें', 'यह पता पेस्ट करें'],
};

export const GROK_WEB_QUICK_START = quickStartOf({ hint: GROK_WEB_QUICK_START_HINT, path: GROK_WEB_QUICK_START_PATH, code: addressText });

import { OwnerLocale, TemplateKind } from '@zapbip/types';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from './whatsapp-enums';

export const WHATSAPP_TEMPLATE_BODIES: Record<WhatsAppTemplateName, Record<WhatsAppLanguageCode, string>> = {
  [WhatsAppTemplateName.AgentNotice]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: 'Mensagem de {{1}}: {{2}} — toque em Abrir para ler.',
    [WhatsAppLanguageCode.EnglishUs]: 'Message from {{1}}: {{2}} — tap Open to read it.',
    [WhatsAppLanguageCode.Spanish]: 'Mensaje de {{1}}: {{2}} — toca Abrir para leerlo.',
    [WhatsAppLanguageCode.German]: 'Nachricht von {{1}}: {{2}} — tippe auf Öffnen, um sie zu lesen.',
    [WhatsAppLanguageCode.French]: 'Message de {{1}} : {{2}} — touchez Ouvrir pour le lire.',
    [WhatsAppLanguageCode.Japanese]: 'メッセージが届きました。{{1}}より: {{2}} — 「開く」をタップして読む。',
    [WhatsAppLanguageCode.Korean]: '메시지가 도착했어요. {{1}}님의 메시지: {{2}} — 열기를 눌러 읽어 보세요.',
    [WhatsAppLanguageCode.ChineseSimplified]: '来自 {{1}} 的消息：{{2}} — 点击“打开”查看。',
    [WhatsAppLanguageCode.Arabic]: 'رسالة من {{1}}: {{2}} — اضغط «فتح» لقراءتها.',
    [WhatsAppLanguageCode.Hindi]: 'आपके लिए {{1}} का संदेश: {{2}} — पढ़ने के लिए "खोलें" पर टैप करें।',
  },
  [WhatsAppTemplateName.AgentQuestion]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: 'Pergunta de {{1}}: {{2}} — toque em Responder para ver as opções.',
    [WhatsAppLanguageCode.EnglishUs]: 'Question from {{1}}: {{2}} — tap Reply to see the options.',
    [WhatsAppLanguageCode.Spanish]: 'Pregunta de {{1}}: {{2}} — toca Responder para ver las opciones.',
    [WhatsAppLanguageCode.German]: 'Frage von {{1}}: {{2}} — tippe auf Antworten, um die Optionen zu sehen.',
    [WhatsAppLanguageCode.French]: 'Question de {{1}} : {{2}} — touchez Répondre pour voir les options.',
    [WhatsAppLanguageCode.Japanese]: '質問が届きました。{{1}}より: {{2}} — 「返信」をタップして選択肢を見る。',
    [WhatsAppLanguageCode.Korean]: '질문이 도착했어요. {{1}}님의 질문: {{2}} — 답장을 눌러 선택지를 확인하세요.',
    [WhatsAppLanguageCode.ChineseSimplified]: '来自 {{1}} 的提问：{{2}} — 点击“回复”查看选项。',
    [WhatsAppLanguageCode.Arabic]: 'سؤال من {{1}}: {{2}} — اضغط «رد» لعرض الخيارات.',
    [WhatsAppLanguageCode.Hindi]: 'आपके लिए {{1}} का सवाल: {{2}} — विकल्प देखने के लिए "जवाब दें" पर टैप करें।',
  },
};
export const WHATSAPP_TEMPLATE_QUICK_REPLIES: Record<WhatsAppTemplateName, Record<WhatsAppLanguageCode, string>> = {
  [WhatsAppTemplateName.AgentNotice]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: 'Abrir',
    [WhatsAppLanguageCode.EnglishUs]: 'Open',
    [WhatsAppLanguageCode.Spanish]: 'Abrir',
    [WhatsAppLanguageCode.German]: 'Öffnen',
    [WhatsAppLanguageCode.French]: 'Ouvrir',
    [WhatsAppLanguageCode.Japanese]: '開く',
    [WhatsAppLanguageCode.Korean]: '열기',
    [WhatsAppLanguageCode.ChineseSimplified]: '打开',
    [WhatsAppLanguageCode.Arabic]: 'فتح',
    [WhatsAppLanguageCode.Hindi]: 'खोलें',
  },
  [WhatsAppTemplateName.AgentQuestion]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: 'Responder',
    [WhatsAppLanguageCode.EnglishUs]: 'Reply',
    [WhatsAppLanguageCode.Spanish]: 'Responder',
    [WhatsAppLanguageCode.German]: 'Antworten',
    [WhatsAppLanguageCode.French]: 'Répondre',
    [WhatsAppLanguageCode.Japanese]: '返信',
    [WhatsAppLanguageCode.Korean]: '답장',
    [WhatsAppLanguageCode.ChineseSimplified]: '回复',
    [WhatsAppLanguageCode.Arabic]: 'رد',
    [WhatsAppLanguageCode.Hindi]: 'जवाब दें',
  },
};
export const WHATSAPP_TEMPLATE_SAMPLES: Record<WhatsAppTemplateName, Record<WhatsAppLanguageCode, readonly [string, string]>> = {
  [WhatsAppTemplateName.AgentNotice]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: ['Agente de teste', 'Mensagem de exemplo'],
    [WhatsAppLanguageCode.EnglishUs]: ['Test agent', 'Example message'],
    [WhatsAppLanguageCode.Spanish]: ['Agente de prueba', 'Mensaje de ejemplo'],
    [WhatsAppLanguageCode.German]: ['Test-Agent', 'Beispielnachricht'],
    [WhatsAppLanguageCode.French]: ['Agent de test', 'Message d’exemple'],
    [WhatsAppLanguageCode.Japanese]: ['テストエージェント', 'サンプルメッセージ'],
    [WhatsAppLanguageCode.Korean]: ['테스트 에이전트', '예시 메시지'],
    [WhatsAppLanguageCode.ChineseSimplified]: ['测试智能体', '示例消息'],
    [WhatsAppLanguageCode.Arabic]: ['وكيل تجريبي', 'رسالة مثال'],
    [WhatsAppLanguageCode.Hindi]: ['टेस्ट एजेंट', 'उदाहरण संदेश'],
  },
  [WhatsAppTemplateName.AgentQuestion]: {
    [WhatsAppLanguageCode.PortugueseBrazil]: ['Agente de teste', 'Pergunta de exemplo'],
    [WhatsAppLanguageCode.EnglishUs]: ['Test agent', 'Example question'],
    [WhatsAppLanguageCode.Spanish]: ['Agente de prueba', 'Pregunta de ejemplo'],
    [WhatsAppLanguageCode.German]: ['Test-Agent', 'Beispielfrage'],
    [WhatsAppLanguageCode.French]: ['Agent de test', 'Question d’exemple'],
    [WhatsAppLanguageCode.Japanese]: ['テストエージェント', 'サンプルの質問'],
    [WhatsAppLanguageCode.Korean]: ['테스트 에이전트', '예시 질문'],
    [WhatsAppLanguageCode.ChineseSimplified]: ['测试智能体', '示例问题'],
    [WhatsAppLanguageCode.Arabic]: ['وكيل تجريبي', 'سؤال مثال'],
    [WhatsAppLanguageCode.Hindi]: ['टेस्ट एजेंट', 'उदाहरण सवाल'],
  },
};
// NB ADR 0051: a language sends the template of its row; every language beyond English and Portuguese sends the English one until Meta approves its own and the row is flipped.
export const OWNER_LOCALE_TO_LANGUAGE_CODE: Record<OwnerLocale, WhatsAppLanguageCode> = {
  [OwnerLocale.PortugueseBrazil]: WhatsAppLanguageCode.PortugueseBrazil,
  [OwnerLocale.EnglishUs]: WhatsAppLanguageCode.EnglishUs,
  [OwnerLocale.Spanish]: WhatsAppLanguageCode.EnglishUs,
  [OwnerLocale.German]: WhatsAppLanguageCode.EnglishUs,
  [OwnerLocale.French]: WhatsAppLanguageCode.EnglishUs,
  [OwnerLocale.Japanese]: WhatsAppLanguageCode.EnglishUs,
  [OwnerLocale.Korean]: WhatsAppLanguageCode.EnglishUs,
  [OwnerLocale.ChineseSimplified]: WhatsAppLanguageCode.EnglishUs,
  [OwnerLocale.Arabic]: WhatsAppLanguageCode.EnglishUs,
  [OwnerLocale.Hindi]: WhatsAppLanguageCode.EnglishUs,
};
export const TEMPLATE_NAME_BY_KIND: Record<TemplateKind, WhatsAppTemplateName> = {
  [TemplateKind.Notice]: WhatsAppTemplateName.AgentNotice,
  [TemplateKind.QuestionNotice]: WhatsAppTemplateName.AgentQuestion,
};

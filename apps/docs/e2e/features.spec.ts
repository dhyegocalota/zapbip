import { expect, test } from '@playwright/test';
import { DocsPageLanguage, MessageKind } from '@zapbip/types';
import { DOCS_LOCALE_OF, DocsViewport, docsOptionsOf } from './support/docs-experience';
import { twinPathOf } from '../../../libs/agents/src/docs';

const OK_STATUS = 200;
const CHAT_SELECTOR = '#content-area [role="group"][aria-label^="WhatsApp"]';
const FEATURE_PAGES = [
  'features/send-messages-and-media',
  'features/ask-with-buttons-and-lists',
  'features/owner-starts-conversations',
  'features/many-agents-on-one-number',
  'features/whatsapp-commands',
];
const LISTEN_DELAY_SECONDS = ['7', '6', '9', '16'];
const WAKE_RUNG_WORDS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['connector', 'webhook', 'scheduled', 'inbox'],
  [DocsPageLanguage.PortugueseBrazil]: ['conector', 'webhook', 'agendad', 'caixa de entrada'],
  [DocsPageLanguage.Spanish]: ['conector', 'webhook', 'programad', 'bandeja de entrada'],
  [DocsPageLanguage.German]: ['connector', 'webhook', 'geplant', 'posteingang'],
  [DocsPageLanguage.French]: ['connecteur', 'webhook', 'planifi', 'boîte de réception'],
  [DocsPageLanguage.Japanese]: ['コネクタ', 'webhook', 'スケジュール', '受信トレイ'],
  [DocsPageLanguage.Korean]: ['커넥터', 'webhook', '예약', '받은편지함'],
  [DocsPageLanguage.Chinese]: ['连接器', 'webhook', '定时', '收件箱'],
  [DocsPageLanguage.Arabic]: ['موصّل', 'webhook', 'مجدول', 'صندوق الوارد'],
  [DocsPageLanguage.Hindi]: ['कनेक्टर', 'webhook', 'शेड्यूल्ड', 'इनबॉक्स'],
};
const NOT_LISTENING_TOKEN: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'is not listening right now',
  [DocsPageLanguage.PortugueseBrazil]: 'não está ouvindo agora',
  [DocsPageLanguage.Spanish]: 'no está escuchando ahora',
  [DocsPageLanguage.German]: 'hört gerade nicht zu',
  [DocsPageLanguage.French]: 'n’écoute pas pour le moment',
  [DocsPageLanguage.Japanese]: '現在待ち受けていません',
  [DocsPageLanguage.Korean]: '지금은 듣고 있지 않아요',
  [DocsPageLanguage.Chinese]: '现在没有在监听',
  [DocsPageLanguage.Arabic]: 'لا يستمع الآن',
  [DocsPageLanguage.Hindi]: 'अभी नहीं सुन रहा है',
};
const COMMAND_WORDS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['new agent', 'agents', 'revoke', 'rotate', 'help', 'delete account', 'delete account permanently'],
  [DocsPageLanguage.PortugueseBrazil]: [
    'novo agente',
    'agentes',
    'revogar',
    'renovar',
    'ajuda',
    'apagar conta',
    'apagar conta definitivamente',
  ],
  [DocsPageLanguage.Spanish]: [
    'nuevo agente',
    'mis agentes',
    'revocar',
    'rotar',
    'ayuda',
    'eliminar cuenta',
    'eliminar cuenta definitivamente',
  ],
  [DocsPageLanguage.German]: [
    'neuer agent',
    'meine agenten',
    'widerrufen',
    'erneuern',
    'hilfe',
    'konto löschen',
    'konto endgültig löschen',
  ],
  [DocsPageLanguage.French]: [
    'nouvel agent',
    'mes agents',
    'révoquer',
    'renouveler',
    'aide',
    'supprimer le compte',
    'supprimer le compte définitivement',
  ],
  [DocsPageLanguage.Japanese]: [
    '新規エージェント',
    'エージェント一覧',
    '無効化',
    '再発行',
    'ヘルプ',
    'アカウント削除',
    'アカウント完全削除',
  ],
  [DocsPageLanguage.Korean]: ['새 에이전트', '에이전트 목록', '폐기', '재발급', '도움말', '계정 삭제', '계정 영구 삭제'],
  [DocsPageLanguage.Chinese]: ['新建智能体', '智能体列表', '撤销', '轮换', '帮助', '删除账户', '永久删除账户'],
  [DocsPageLanguage.Arabic]: ['وكيل جديد', 'وكلائي', 'إبطال', 'تجديد رابط', 'مساعدة', 'حذف الحساب', 'حذف الحساب نهائيا'],
  [DocsPageLanguage.Hindi]: [
    'नया एजेंट',
    'मेरे एजेंट',
    'एजेंट हटाएँ',
    'लिंक बदलें',
    'मदद',
    'अकाउंट डिलीट करें',
    'अकाउंट हमेशा के लिए डिलीट करें',
  ],
};
const OTHER_LANGUAGE_COMMAND_WORDS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: COMMAND_WORDS[DocsPageLanguage.PortugueseBrazil],
  [DocsPageLanguage.PortugueseBrazil]: COMMAND_WORDS[DocsPageLanguage.English],
  [DocsPageLanguage.Spanish]: COMMAND_WORDS[DocsPageLanguage.English],
  [DocsPageLanguage.German]: COMMAND_WORDS[DocsPageLanguage.English],
  [DocsPageLanguage.French]: COMMAND_WORDS[DocsPageLanguage.English],
  [DocsPageLanguage.Japanese]: COMMAND_WORDS[DocsPageLanguage.English],
  [DocsPageLanguage.Korean]: COMMAND_WORDS[DocsPageLanguage.English],
  [DocsPageLanguage.Chinese]: COMMAND_WORDS[DocsPageLanguage.English],
  [DocsPageLanguage.Arabic]: ['new agent', 'agents', 'revoke', 'rotate', 'help', 'delete account', 'delete account permanently'],
  [DocsPageLanguage.Hindi]: ['new agent', 'agents', 'revoke', 'rotate', 'help', 'delete account', 'delete account permanently'],
};
const RESERVED_NAME_TOKEN: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'reserved',
  [DocsPageLanguage.PortugueseBrazil]: 'reservad',
  [DocsPageLanguage.Spanish]: 'reservad',
  [DocsPageLanguage.German]: 'reserviert',
  [DocsPageLanguage.French]: 'réservé',
  [DocsPageLanguage.Japanese]: '予約',
  [DocsPageLanguage.Korean]: '예약',
  [DocsPageLanguage.Chinese]: '保留',
  [DocsPageLanguage.Arabic]: 'محجوزة',
  [DocsPageLanguage.Hindi]: 'आरक्षित',
};
const FORWARDED_TOKEN: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'forwarded',
  [DocsPageLanguage.PortugueseBrazil]: 'encaminhad',
  [DocsPageLanguage.Spanish]: 'reenviad',
  [DocsPageLanguage.German]: 'weitergeleitet',
  [DocsPageLanguage.French]: 'transféré',
  [DocsPageLanguage.Japanese]: '転送',
  [DocsPageLanguage.Korean]: '전달',
  [DocsPageLanguage.Chinese]: '转发',
  [DocsPageLanguage.Arabic]: 'المعاد توجيهها',
  [DocsPageLanguage.Hindi]: 'फ़ॉरवर्ड',
};

function urlOf(input: { path: string; language: DocsPageLanguage }): string {
  return `/${twinPathOf({ path: input.path, language: input.language })}`;
}

for (const language of Object.values(DocsPageLanguage)) {
  test.describe(`feature pages in ${language}`, () => {
    test.use(docsOptionsOf({ language, viewport: DocsViewport.Desktop }));
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.use.locale !== DOCS_LOCALE_OF[language]);
    });

    for (const path of FEATURE_PAGES) {
      test(`${path} opens and shows at least one conversation`, async ({ page }) => {
        const response = await page.goto(urlOf({ path, language }));
        expect(response?.status()).toBe(OK_STATUS);
        await expect(page.locator(CHAT_SELECTOR).first()).toBeVisible();
      });
    }

    test('send-messages-and-media names every message kind', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/send-messages-and-media', language }));
      for (const kind of Object.values(MessageKind)) await expect(page.locator('#content-area')).toContainText(kind);
    });

    test('owner-starts-conversations explains the wake ladder with the expected delays', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/owner-starts-conversations', language }));
      const content = page.locator('#content-area');
      for (const word of WAKE_RUNG_WORDS[language]) await expect(content).toContainText(word, { ignoreCase: true });
      for (const seconds of LISTEN_DELAY_SECONDS) await expect(content).toContainText(seconds);
    });

    test('owner-starts-conversations shows the not-listening notice', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/owner-starts-conversations', language }));
      await expect(page.locator(CHAT_SELECTOR).filter({ hasText: NOT_LISTENING_TOKEN[language] }).first()).toBeVisible();
    });

    test('whatsapp-commands lists every command word with the other language beside it', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/whatsapp-commands', language }));
      const table = page.locator('#content-area table').first();
      for (const word of [...COMMAND_WORDS[language], ...OTHER_LANGUAGE_COMMAND_WORDS[language]]) await expect(table).toContainText(word);
    });

    test('whatsapp-commands states the reserved names rule and that forwarded messages never run a command', async ({ page }) => {
      await page.goto(urlOf({ path: 'features/whatsapp-commands', language }));
      const content = page.locator('#content-area');
      await expect(content).toContainText(RESERVED_NAME_TOKEN[language], { ignoreCase: true });
      await expect(content).toContainText(FORWARDED_TOKEN[language], { ignoreCase: true });
    });
  });
}

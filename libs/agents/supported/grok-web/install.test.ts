import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { installSnapshotTests, installWakeNoteTests, LOCALES, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const STANDBY_AGENT = 'Ana Bot';
const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O Grok na web não acorda sozinho: o agente de prontidão escolhido responde por ele em segundos.',
  [OwnerLocale.EnglishUs]: 'Grok on the web cannot be woken from outside: the chosen standby agent answers for it within seconds.',
  [OwnerLocale.Spanish]: 'Grok en la web no se puede despertar desde fuera: el agente de reserva elegido responde por él en segundos.',
  [OwnerLocale.German]: 'Grok im Web kann nicht von außen geweckt werden: Der gewählte Standby-Agent antwortet in Sekunden für ihn.',
  [OwnerLocale.French]:
    'Grok sur le web ne peut pas être réveillé de l’extérieur\u00a0: l’agent de secours choisi répond à sa place en quelques secondes.',
  [OwnerLocale.Japanese]: 'Web版のGrokは外部から起動できません。選ばれた待機エージェントが、数秒で代わりに応答します。',
  [OwnerLocale.Korean]: '웹의 Grok은 외부에서 깨울 수 없어요. 선택한 대기 에이전트가 몇 초 안에 대신 답해요.',
  [OwnerLocale.ChineseSimplified]: '网页版 Grok 无法从外部唤醒：所选的备用智能体会在几秒内代它回应。',
};
const WAKE_NOTE_WITHOUT_STANDBY: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Sem um agente de prontidão, o Grok na web só vê mensagens novas quando você abre o chat dele.',
  [OwnerLocale.EnglishUs]: 'Without a standby agent, Grok on the web sees new messages only when you open the chat.',
  [OwnerLocale.Spanish]: 'Sin un agente de reserva, Grok en la web ve los mensajes nuevos solo cuando abres el chat.',
  [OwnerLocale.German]: 'Ohne Standby-Agent sieht Grok im Web neue Nachrichten nur, wenn du den Chat öffnest.',
  [OwnerLocale.French]: 'Sans agent de secours, Grok sur le web ne voit les nouveaux messages que lorsque vous ouvrez la conversation.',
  [OwnerLocale.Japanese]: '待機エージェントがない場合、Web版のGrokは、あなたがチャットを開いたときにだけ新しいメッセージを見られます。',
  [OwnerLocale.Korean]: '대기 에이전트가 없으면 웹의 Grok은 사용자가 채팅을 열었을 때만 새 메시지를 봐요.',
  [OwnerLocale.ChineseSimplified]: '没有备用智能体的话，只有你打开聊天时，网页版 Grok 才能看到新消息。',
};

describe('the Grok web install section', () => {
  installSnapshotTests({ install });

  test.each(LOCALES)('renders the section with a standby agent it rendered before in %s', async (locale) => {
    await expect(install.render(sectionInput({ locale, standbyAgent: STANDBY_AGENT }))).toMatchFileSnapshot(
      `./install.standby.${locale}.md`,
    );
  });

  test('uses the standby agent when there is one', () => {
    const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs, standbyAgent: STANDBY_AGENT }));
    expect(text).toContain('set_wake({mode: "standby", standby_agent: "Ana Bot"})');
    expect(text).not.toContain('set_wake({mode: "none"})');
  });

  test('sets none without a standby agent', () => {
    const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs, standbyAgent: null }));
    expect(text).toContain('set_wake({mode: "none"})');
    expect(text).not.toContain('standby_agent');
  });

  test('JSON-escapes the standby name so it cannot break out of the call', () => {
    const standbyAgent = 'Ana "Bot"\n';
    const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs, standbyAgent }));
    expect(text).toContain(`set_wake({mode: "standby", standby_agent: ${JSON.stringify(standbyAgent)}})`);
    expect(text).not.toContain('Ana "Bot"\n');
  });

  test.each(LOCALES)('F3 says the chat is only read when opened without a standby agent, in %s', (locale) => {
    const withoutStandby = install.render(sectionInput({ locale, standbyAgent: null }));
    const withStandby = install.render(sectionInput({ locale, standbyAgent: STANDBY_AGENT }));
    expect(withoutStandby).toContain(WAKE_NOTE_WITHOUT_STANDBY[locale]);
    expect(withStandby).toContain(WAKE_NOTE[locale]);
    expect(withoutStandby).not.toContain(WAKE_NOTE[locale]);
    expect(withStandby).not.toContain(WAKE_NOTE_WITHOUT_STANDBY[locale]);
  });

  test.each(LOCALES)('C4 says how it is woken before the self-test in %s', (locale) => {
    const text = install.render(sectionInput({ locale, standbyAgent: STANDBY_AGENT }));
    expect(text.indexOf(WAKE_NOTE[locale])).toBeLessThan(text.lastIndexOf('send_message'));
  });
});

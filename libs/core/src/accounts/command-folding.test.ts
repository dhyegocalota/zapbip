import { CommandKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { foldCommandText } from './command-folding';
import { parseAccountCommand } from './command';

function say(text: string) {
  return parseAccountCommand({ text, isQuoting: false, listReplyId: null });
}

describe('foldCommandText', () => {
  it.each([
    ['ابطال', 'ابطال'],
    ['إبطال', 'ابطال'],
    ['أحد', 'احد'],
    ['آخر', 'اخر'],
    ['اللغى', 'اللغي'],
    ['حساب نهائيًا', 'حساب نهائيا'],
    ['مســـاعدة', 'مساعده'],
    ['مُسَاعَدَة', 'مساعده'],
    ['مساعدة؟', 'مساعده?'],
  ])('folds %s into %s', (text, folded) => {
    expect(foldCommandText({ text })).toBe(folded);
  });

  it.each(['revoke Claude', 'revogar Foo', 'agents?', 'ログイン', '登录', '새 에이전트 Foo', 'Ünïcode', ''])(
    'leaves %j as it is',
    (text) => {
      expect(foldCommandText({ text })).toBe(text);
    },
  );
});

describe('the Arabic commands', () => {
  it.each([
    ['إبطال claude', CommandKind.RevokeAgent, 'claude'],
    ['ابطال claude', CommandKind.RevokeAgent, 'claude'],
    ['إِبْطَال claude', CommandKind.RevokeAgent, 'claude'],
    ['تجديد رابط claude', CommandKind.RotateAgent, 'claude'],
    ['تجديد  رابط   Claude', CommandKind.RotateAgent, 'Claude'],
    ['تغيير اللغة ja', CommandKind.SetLanguage, 'ja'],
    ['تغيير  اللغه ja', CommandKind.SetLanguage, 'ja'],
    ['وكيل جديد claude', CommandKind.CreateAgent, 'claude'],
  ])('reads %j as %s for %j', (text, kind, rawName) => {
    expect(say(text)).toEqual({ kind, rawName, locale: OwnerLocale.Arabic });
  });

  it.each([
    ['حذف الحساب نهائيا', CommandKind.ConfirmDeletion],
    ['حذف الحساب نهائيًا', CommandKind.ConfirmDeletion],
    ['حذف الحساب', CommandKind.RequestDeletion],
    ['مساعدة', CommandKind.Help],
    ['القائمة', CommandKind.Help],
    ['وكلائي', CommandKind.ListAgents],
    ['دخول', CommandKind.Login],
  ])('reads the whole message %j as %s', (text, kind) => {
    expect(say(text)?.kind).toBe(kind);
  });

  it.each(['مساعدة؟', 'وكلائي؟', 'دخول!', 'اللغة العربية جميلة', 'تجديد الاشتراك', 'تجديد العقد السنوي', 'تغيير الموضوع'])(
    'keeps %j an ordinary message',
    (text) => {
      expect(say(text)).toBeNull();
    },
  );
});

describe('the other languages', () => {
  it.each([
    ['revoke Claude', CommandKind.RevokeAgent, 'Claude', OwnerLocale.EnglishUs],
    ['revogar Foo', CommandKind.RevokeAgent, 'Foo', OwnerLocale.PortugueseBrazil],
    ['renovar  Foo', CommandKind.RotateAgent, 'Foo', OwnerLocale.PortugueseBrazil],
    ['新規エージェント Foo', CommandKind.CreateAgent, 'Foo', OwnerLocale.Japanese],
    ['새 에이전트 Foo', CommandKind.CreateAgent, 'Foo', OwnerLocale.Korean],
  ])('still reads %j as %s', (text, kind, rawName, locale) => {
    expect(say(text)).toEqual({ kind, rawName, locale });
  });
});

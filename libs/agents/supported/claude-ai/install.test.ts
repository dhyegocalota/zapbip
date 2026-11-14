import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { installSnapshotTests, installWakeNoteTests, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]:
    'O webhook da rotina acorda o claude.ai em cerca de 16 segundos; a tarefa agendada de segurança roda no máximo uma vez a cada 60 minutos, limite da plataforma.',
  [OwnerLocale.EnglishUs]:
    'The routine webhook wakes claude.ai in about 16 seconds; the safety-net scheduled task runs at most once every 60 minutes, a platform minimum.',
  [OwnerLocale.Spanish]:
    'El webhook de la rutina despierta a claude.ai en unos 16 segundos; la tarea programada de respaldo se ejecuta como máximo una vez cada 60 minutos, un mínimo de la plataforma.',
  [OwnerLocale.German]:
    'Der Routine-Webhook weckt claude.ai in etwa 16 Sekunden; die geplante Sicherheitsaufgabe läuft höchstens einmal alle 60 Minuten, ein Minimum der Plattform.',
  [OwnerLocale.French]:
    'Le webhook de la routine réveille claude.ai en environ 16 secondes\u202f; la tâche planifiée de secours s’exécute au plus une fois toutes les 60 minutes, un minimum de la plateforme.',
  [OwnerLocale.Japanese]:
    'ルーティンのWebhookは約16秒でclaude.aiを起動します。保険のスケジュールタスクは、プラットフォームの下限である60分に1回までしか実行されません。',
  [OwnerLocale.Korean]: '루틴 웹훅은 약 16초 만에 claude.ai를 깨웁니다. 안전망 예약 작업은 플랫폼의 최소 주기인 60분에 한 번만 실행됩니다.',
  [OwnerLocale.ChineseSimplified]:
    '例行任务的 Webhook 大约 16 秒就能唤醒 claude.ai；作为保险的计划任务最多每 60 分钟运行一次，这是平台的最低间隔。',
  [OwnerLocale.Arabic]:
    'يوقظ webhook الروتين claude.ai خلال نحو 16 ثانية؛ أما المهمة المجدولة الاحتياطية فتعمل مرة واحدة كل 60 دقيقة على الأكثر، وهذا حد أدنى تفرضه المنصة.',
};

describe('the claude.ai install section', () => {
  const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs }));

  installSnapshotTests({ install });
  installWakeNoteTests({ install, wakeNote: WAKE_NOTE });

  test('asks for the connector paste and the fire URL and token', () => {
    expect(text).toContain('custom connector');
    expect(text).toContain('fire URL and token');
    expect(text).toContain('set_wake({mode: "webhook"');
  });

  test('asks for the hourly check_inbox safety net and has the stop branch', () => {
    expect(text).toContain('hourly');
    expect(text).toContain('check_inbox');
    expect(text).toContain('set_wake({mode: "none"})');
  });

  test('C1 holds no English trigger wording in Portuguese', () => {
    expect(install.render(sectionInput({ locale: OwnerLocale.PortugueseBrazil }))).not.toContain('fire URL and token');
  });

  test('F10 says in Portuguese the safety net runs at most once every 60 minutes', () => {
    expect(install.render(sectionInput({ locale: OwnerLocale.PortugueseBrazil }))).toContain('no máximo uma vez a cada 60 minutos');
  });
});

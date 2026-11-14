import { HEARTBEAT_POLL_INTERVAL_MINUTES, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CONNECTION_LINK, installSnapshotTests, installWakeNoteTests, LOCALES, sectionInput } from '../../testing/install-fixtures';
import { AGENT_INSTALLS } from '../../src/generated/install';
import { install } from './install';
import { REQUIREMENTS_SHA256 } from './wheel';

const otherProductNames = Object.values(AGENT_INSTALLS)
  .map((other) => other.productName)
  .filter((name) => name !== install.productName);

const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]:
    'O plugin entrega cada mensagem na hora; sem o plugin, o Hermes verifica a caixa de entrada a cada minuto.',
  [OwnerLocale.EnglishUs]: 'The plugin delivers each message at once; without the plugin, Hermes checks the inbox every minute.',
  [OwnerLocale.Spanish]: 'El plugin entrega cada mensaje al instante; sin el plugin, Hermes revisa la bandeja de entrada cada minuto.',
  [OwnerLocale.German]: 'Das Plugin liefert jede Nachricht sofort; ohne das Plugin prüft Hermes den Posteingang jede Minute.',
  [OwnerLocale.French]:
    'Le plugin livre chaque message aussitôt\u202f; sans le plugin, Hermes consulte la boîte de réception chaque minute.',
  [OwnerLocale.Japanese]: 'プラグインはメッセージを即座に配信します。プラグインがない場合、Hermesは1分ごとに受信箱を確認します。',
  [OwnerLocale.Korean]: '플러그인은 각 메시지를 즉시 전달합니다. 플러그인이 없으면 Hermes가 1분마다 받은 편지함을 확인합니다.',
  [OwnerLocale.ChineseSimplified]: '插件会立即送达每条消息；没有插件时，Hermes 每分钟检查一次收件箱。',
  [OwnerLocale.Arabic]: 'يسلّم المكوّن الإضافي كل رسالة فورًا؛ ومن دونه يفحص Hermes صندوق الوارد كل دقيقة.',
};

describe('the Hermes install section', () => {
  installSnapshotTests({ install });
  installWakeNoteTests({ install, wakeNote: WAKE_NOTE });

  test.each(LOCALES)('names only its own product and polls every minute in %s', (locale) => {
    const text = install.render(sectionInput({ locale }));
    expect(text).toContain(`If you are not ${install.productName}`);
    otherProductNames.forEach((name) => expect(text).not.toContain(name));
    expect(text).toContain(`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})`);
    expect(HEARTBEAT_POLL_INTERVAL_MINUTES).toBe(1);
    expect(text).toContain('check_inbox');
    expect(text).toContain('every minute');
    expect(text).not.toContain('(verify)');
  });

  test.each(LOCALES)('sets the owner as an allowed user in %s', (locale) => {
    expect(install.render(sectionInput({ locale }))).toContain('ZAPBIP_ALLOWED_USERS=owner');
  });

  test.each(LOCALES)('C3 makes the plugin the listener and the every-minute job only the fallback in %s', (locale) => {
    const text = install.render(sectionInput({ locale }));
    expect(text).toContain('The plugin is the listener, with no time limit');
    expect(text).toContain('Only if the plugin cannot be installed, and never together with it');
    expect(text.match(/Only if the plugin cannot be installed/g)).toHaveLength(1);
  });

  test('F4 names the plugin folder, the enable key and both environment variables', () => {
    const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs }));
    expect(text).toContain('importable by Hermes');
    expect(text).not.toContain('plugins.enabled');
    expect(text).toContain(`ZAPBIP_CONNECTION_LINK=${CONNECTION_LINK}`);
    expect(text).toContain('ZAPBIP_ALLOWED_USERS=owner');
    expect(text).toContain(
      `d=$(mktemp -d) && curl -fsSL https://mcp.zapbip.com/pkg/zapbip_platform-0.1.0-requirements.txt -o "$d/zapbip-requirements.txt" && python3 -c 'import hashlib,sys; sys.exit(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest() != sys.argv[2])' "$d/zapbip-requirements.txt" ${REQUIREMENTS_SHA256} && python3 -m pip install --only-binary=:all: --require-hashes -r "$d/zapbip-requirements.txt"`,
    );
    expect(text).not.toContain('sha256sum');
    expect(text).not.toContain('zapbip-platform==');
  });

  test('ends its config step with what success looks like', () => {
    expect(install.render(sectionInput({ locale: OwnerLocale.EnglishUs }))).toContain(
      'Success: `config.yaml` holds the zapbip entry under `mcp_servers`.',
    );
  });
});

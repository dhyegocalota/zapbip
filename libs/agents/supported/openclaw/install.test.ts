import { HEARTBEAT_POLL_INTERVAL_MINUTES, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CONNECTION_LINK, installSnapshotTests, installWakeNoteTests, LOCALES, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]:
    'O plugin entrega cada mensagem na hora; sem o plugin, o OpenClaw verifica a caixa de entrada a cada minuto.',
  [OwnerLocale.EnglishUs]: 'The plugin delivers each message at once; without the plugin, OpenClaw checks the inbox every minute.',
};

describe('the OpenClaw install section', () => {
  installSnapshotTests({ install });
  installWakeNoteTests({ install, wakeNote: WAKE_NOTE });

  test.each(LOCALES)('names only its own product and polls every minute in %s', (locale) => {
    const text = install.render(sectionInput({ locale }));
    expect(text).toContain('If you are not OpenClaw');
    expect(text).not.toContain('Hermes');
    expect(text).toContain(`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})`);
    expect(text).toContain('check_inbox');
    expect(text).toContain('every minute');
    expect(text).not.toContain('(verify)');
  });

  test.each(LOCALES)('C3 makes the plugin the listener and the every-minute job only the fallback in %s', (locale) => {
    const text = install.render(sectionInput({ locale }));
    expect(text).toContain('The plugin is the listener, with no time limit');
    expect(text).toContain('Only if the plugin cannot be installed, and never together with it');
    expect(text.match(/Only if the plugin cannot be installed/g)).toHaveLength(1);
  });

  test('F4 installs the published package and sets the connection link on the channel', () => {
    const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs }));
    expect(text).toContain(`openclaw plugins install @zapbip/openclaw-plugin@${ZAPBIP_NPM_VERSION} --force --accept-capabilities`);
    expect(text).toContain('Authorization: Bearer');
    expect(text).toContain('channels.zapbip.connectionLink');
    expect(text).toContain(CONNECTION_LINK);
  });

  test.each([
    { locale: OwnerLocale.EnglishUs, permissionNotice: 'reads your messages' },
    { locale: OwnerLocale.PortugueseBrazil, permissionNotice: 'lê as suas mensagens' },
  ])('F4b tells the owner in $locale what the plugin may do before the install command', ({ locale, permissionNotice }) => {
    const text = install.render(sectionInput({ locale }));
    expect(text).toContain(permissionNotice);
    expect(text.indexOf(permissionNotice)).toBeLessThan(text.indexOf('openclaw plugins install'));
  });
});

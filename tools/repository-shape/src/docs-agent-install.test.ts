import { HERMES_INSTALL_COMMAND } from '@zapbip/core';
import { INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const PAGE_LOCALES = ['apps/docs', 'apps/docs/pt-br'];
const FEATURE_SPEC = 'docs/features/hermes-openclaw/spec.md';
const OPENCLAW_PAGE = 'agents/openclaw.mdx';
const HERMES_PAGE = 'agents/hermes.mdx';
const OPENCLAW_INSTALL_COMMAND = 'openclaw plugins install @zapbip/openclaw-plugin@0.1.0 --force --accept-capabilities';
const OPENCLAW_ENABLE_ENTRY = '"plugins": { "entries": { "zapbip": { "enabled": true } } }';
const OPENCLAW_LINK_KEY = '"channels": { "zapbip": { "connectionLink"';
const UNPINNED_HERMES_INSTALL = 'zapbip-platform==';
const HASH_CHECKED_INSTALL_TOKENS = ['d=$(mktemp -d)', 'hashlib.sha256', '--only-binary=:all:', '--require-hashes'];
const NON_PORTABLE_HASH_TOOL = 'sha256sum';
const HERMES_ENVIRONMENT_VARIABLES = ['ZAPBIP_CONNECTION_LINK', 'ZAPBIP_ALLOWED_USERS'];
const ONE_LISTENER_SENTENCES: Record<string, string> = {
  'apps/docs':
    'Run only one listener per agent: the plugin or `npx zapbip@0.1.0 listen`, never both. A second listener replaces the first.',
  'apps/docs/pt-br':
    'Rode apenas um listener por agente: o plugin ou `npx zapbip@0.1.0 listen`, nunca os dois. Um segundo listener substitui o primeiro.',
};
const SELF_TEST_TEXTS: Record<string, string> = {
  'apps/docs': INSTALL_SELF_TEST_TEXT[OwnerLocale.EnglishUs],
  'apps/docs/pt-br': INSTALL_SELF_TEST_TEXT[OwnerLocale.PortugueseBrazil],
};
const LOST_REPLY_EVENT = 'plugin_reply_failed';
const PRIVATE_FILE_PERMISSION = 'chmod 600';

function page({ locale, path }: { locale: string; path: string }): string {
  return readRepositoryFile(`${locale}/${path}`);
}

describe.each(PAGE_LOCALES)('the agent install pages in %s', (locale) => {
  test('the OpenClaw page prints the verified install command and the config', () => {
    const text = page({ locale, path: OPENCLAW_PAGE });
    expect(text).toContain(OPENCLAW_INSTALL_COMMAND);
    expect(text).toContain(OPENCLAW_ENABLE_ENTRY);
    expect(text).toContain(OPENCLAW_LINK_KEY);
    expect(text).toContain(LOST_REPLY_EVENT);
  });

  test('the Hermes page prints the verified install command and the environment variables', () => {
    const text = page({ locale, path: HERMES_PAGE });
    expect(text).toContain(HERMES_INSTALL_COMMAND);
    expect(text).not.toContain(UNPINNED_HERMES_INSTALL);
    HASH_CHECKED_INSTALL_TOKENS.forEach((token) => expect(text).toContain(token));
    expect(text).not.toContain(NON_PORTABLE_HASH_TOOL);
    HERMES_ENVIRONMENT_VARIABLES.forEach((name) => expect(text).toContain(name));
  });

  test.each([OPENCLAW_PAGE, HERMES_PAGE])('%s tells the owner to keep the file with the link readable only by them', (path) => {
    expect(page({ locale, path })).toContain(PRIVATE_FILE_PERMISSION);
  });

  test.each([OPENCLAW_PAGE, HERMES_PAGE])('%s tells the owner to run only one listener per agent', (path) => {
    expect(page({ locale, path })).toContain(ONE_LISTENER_SENTENCES[locale]);
  });

  test.each([OPENCLAW_PAGE, HERMES_PAGE])('%s asks the agent to send the self-test text', (path) => {
    expect(page({ locale, path })).toContain(SELF_TEST_TEXTS[locale]);
  });
});

describe('the feature spec', () => {
  test('names the verified OpenClaw install command in the rungs table', () => {
    expect(readRepositoryFile(FEATURE_SPEC)).toContain(OPENCLAW_INSTALL_COMMAND);
  });
});

import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const PAGE_LOCALES = ['apps/docs', 'apps/docs/pt-br'];
const FEATURE_SPEC = 'docs/features/hermes-openclaw/spec.md';
const OPENCLAW_PAGE = 'agents/openclaw.mdx';
const HERMES_PAGE = 'agents/hermes.mdx';
const OPENCLAW_INSTALL_COMMAND = 'openclaw plugins install @zapbip/openclaw-plugin@0.1.0 --force --accept-capabilities';
const OPENCLAW_ENABLE_ENTRY = '"plugins": { "entries": { "zapbip": { "enabled": true } } }';
const OPENCLAW_LINK_KEY = '"channels": { "zapbip": { "connectionLink"';
const HERMES_INSTALL_COMMAND = 'pip install zapbip-platform==0.1.0';
const HERMES_ENVIRONMENT_VARIABLES = ['ZAPBIP_CONNECTION_LINK', 'ZAPBIP_ALLOWED_USERS'];
const SELF_TEST_TEXT = '✅ instalado';
const LOST_REPLY_EVENT = 'plugin_reply_failed';

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
    HERMES_ENVIRONMENT_VARIABLES.forEach((name) => expect(text).toContain(name));
  });

  test.each([OPENCLAW_PAGE, HERMES_PAGE])('%s asks the agent to send the self-test text', (path) => {
    expect(page({ locale, path })).toContain(SELF_TEST_TEXT);
  });
});

describe('the feature spec', () => {
  test('names the verified OpenClaw install command in the rungs table', () => {
    expect(readRepositoryFile(FEATURE_SPEC)).toContain(OPENCLAW_INSTALL_COMMAND);
  });
});

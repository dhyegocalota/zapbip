import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { plugin } from './plugin';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

describe('the fixture plugin', () => {
  test.each(plugin.hostedArtifacts)('hosts $label under /pkg/ and pins the hash of the file in its release folder', (artifact) => {
    const file = readFileSync(`${REPOSITORY_ROOT}${artifact.releaseFolder}/${artifact.filename}`);
    expect(artifact.path).toBe(`/pkg/${artifact.filename}`);
    expect(artifact.expectedSha256).toMatch(SHA256_PATTERN);
    expect(createHash('sha256').update(file).digest('hex')).toBe(artifact.expectedSha256);
  });

  test('embeds the hash of every artifact it marks in its install command', () => {
    plugin.hostedArtifacts
      .filter((artifact) => artifact.embeddedInInstallCommand)
      .forEach((artifact) => expect(plugin.installCommand).toContain(artifact.expectedSha256));
  });

  test('pins its version in its package', () => {
    const manifest = readFileSync(`${REPOSITORY_ROOT}${plugin.versionPins[0]?.path}`, 'utf8');
    plugin.versionPins.forEach((pin) => expect(manifest).toMatch(pin.pattern));
  });
});

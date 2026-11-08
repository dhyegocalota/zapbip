import { AGENT_PLUGINS } from '@zapbip/agents/plugins';
import { describe, expect, it } from 'vitest';
import { SERVED_PACKAGES } from '../../src/routes/package';

describe('the /pkg/ allowlist', () => {
  it('serves exactly the filenames the registered plugins host', () => {
    const hostedFilenames = Object.values(AGENT_PLUGINS).flatMap((plugin) => plugin.hostedArtifacts.map((artifact) => artifact.filename));
    expect(SERVED_PACKAGES.map((served) => served.filename).sort()).toEqual(hostedFilenames.sort());
  });

  it('serves each hosted artifact with its own content type', () => {
    const hostedArtifacts = Object.values(AGENT_PLUGINS).flatMap((plugin) => plugin.hostedArtifacts);
    hostedArtifacts.forEach((artifact) => {
      expect(SERVED_PACKAGES.find((served) => served.filename === artifact.filename)?.contentType).toBe(artifact.contentType);
    });
  });
});

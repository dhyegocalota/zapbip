import { describe, expect, it } from 'vitest';
import { deriveSocketLink } from '../../src/connection-link';

describe('deriveSocketLink', () => {
  it('derives the secure socket link from the MCP link', () => {
    expect(deriveSocketLink({ connectionLink: 'https://zapbip.example/c/abc123/mcp' })).toBe('wss://zapbip.example/c/abc123/connector');
  });

  it('refuses a plain http link and names https', () => {
    expect(() => deriveSocketLink({ connectionLink: 'http://zapbip.example/c/abc123/mcp' })).toThrow(/https/);
  });

  it('refuses a link without the MCP suffix', () => {
    expect(() => deriveSocketLink({ connectionLink: 'https://zapbip.example/c/abc123' })).toThrow(/https/);
  });

  it('refuses text that is not a link', () => {
    expect(() => deriveSocketLink({ connectionLink: 'not a link' })).toThrow(/https/);
  });

  it('never echoes the link in the error', () => {
    const failure = (() => {
      try {
        deriveSocketLink({ connectionLink: 'http://zapbip.example/c/secret-abc123/mcp' });
        return null;
      } catch (error) {
        return error as Error;
      }
    })();
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain('secret-abc123');
  });
});

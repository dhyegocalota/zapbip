import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'AnyMcpClient',
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'Any app with MCP (Model Context Protocol)',
      [DocsLanguage.PortugueseBrazil]: 'Qualquer app com MCP (Model Context Protocol)',
    },
    linkName: {
      [DocsLanguage.English]: 'Any MCP app',
      [DocsLanguage.PortugueseBrazil]: 'Qualquer app MCP',
    },
    pageFacts: {
      [DocsLanguage.English]: ['check_inbox', '/developers/any-mcp-client'],
      [DocsLanguage.PortugueseBrazil]: ['check_inbox', '/developers/any-mcp-client'],
    },
    speakerNames: [],
  },
  listen: {
    rung: WakeRung.Inbox,
    expectedDelaySeconds: null,
    setWakeModes: [],
  },
};
